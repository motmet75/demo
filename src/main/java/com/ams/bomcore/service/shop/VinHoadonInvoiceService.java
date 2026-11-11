package com.ams.bomcore.service.shop;

import com.ams.bomcore.domain.shop.*;
import com.ams.bomcore.integration.vinhoadon.*;
import com.ams.bomcore.repository.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Pattern;

@Service
public class VinHoadonInvoiceService {
    private static final Set<Integer> VAT_RATES = Set.of(-2, -1, 0, 5, 8, 10);
    private static final DateTimeFormatter VIN_DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final Pattern TAX_CODE = Pattern.compile("^[0-9]{10}(?:-[0-9]{3})?$");
    private static final Pattern STANDARD_SERIES_YEAR = Pattern.compile("^[0-9]?[A-Z](\\d{2})");

    private final VinHoadonCompanyConfigRepository configRepository;
    private final VinHoadonShopInvoiceRepository invoiceRepository;
    private final VinHoadonShopInvoiceOrderRepository linkRepository;
    private final ShopOrderRepository orderRepository;
    private final ShopOrderItemRepository itemRepository;
    private final VinHoadonClient client;
    private final VinHoadonSecretCipher cipher;
    private final VinHoadonProperties properties;
    private final ObjectMapper mapper;
    private final TransactionTemplate transactions;

    public VinHoadonInvoiceService(VinHoadonCompanyConfigRepository configRepository,
                                   VinHoadonShopInvoiceRepository invoiceRepository,
                                   VinHoadonShopInvoiceOrderRepository linkRepository,
                                   ShopOrderRepository orderRepository,
                                   ShopOrderItemRepository itemRepository,
                                   VinHoadonClient client,
                                   VinHoadonSecretCipher cipher,
                                   VinHoadonProperties properties,
                                   PlatformTransactionManager transactionManager,
                                   Optional<ObjectMapper> mapper) {
        this.configRepository = configRepository;
        this.invoiceRepository = invoiceRepository;
        this.linkRepository = linkRepository;
        this.orderRepository = orderRepository;
        this.itemRepository = itemRepository;
        this.client = client;
        this.cipher = cipher;
        this.properties = properties;
        this.mapper = mapper.orElseGet(ObjectMapper::new);
        this.transactions = new TransactionTemplate(transactionManager);
    }

    public record ConfigRequest(boolean enabled, String apiEnvironment, String taxCode, String apiUsername, String apiPassword,
                                String invoiceTemplateCode, String invoiceSeries, Integer defaultVatRate,
                                Boolean pricesIncludeVat, String posInvoiceTemplateCode, String posInvoiceSeries,
                                String normalInvoiceTemplateCode, String normalInvoiceSeries) {}
    public record ConfigView(boolean configured, boolean enabled, String apiEnvironment,
                             boolean gatewayEnabled, boolean encryptionConfigured,
                             String taxCode, String apiUsername, boolean passwordConfigured,
                             String invoiceTemplateCode, String invoiceSeries, int defaultVatRate,
                             boolean pricesIncludeVat, String posInvoiceTemplateCode, String posInvoiceSeries,
                             String normalInvoiceTemplateCode, String normalInvoiceSeries) {}
    public record IssueRequest(List<UUID> orderIds, String buyerTaxCode, String buyerOrganizationName,
                               String buyerName, String buyerAddress, String buyerPhone, String buyerEmail,
                               Integer paymentMethod, Integer vatRate, Map<String, String> itemNames,
                               String invoiceSeries, String invoiceType, Boolean pricesIncludeVat) {}
    public record RetryRequest(String invoiceType) {}
    public record TemplateOption(String templateCode, String series, String name) {}
    public record PreviewOrder(UUID id, String orderCode, Integer orderNumber, BigDecimal amount) {}
    public record PreviewLine(String lineId, String code, String name, String unit, BigDecimal quantity,
                              BigDecimal unitPriceBeforeTax, BigDecimal subtotal,
                              BigDecimal taxAmount, BigDecimal total, int vatRate) {}
    public record Preview(List<PreviewOrder> orders, List<PreviewLine> lines, int paymentMethod, int vatRate,
                          boolean pricesIncludeVat, BigDecimal subtotal, BigDecimal taxAmount,
                          BigDecimal totalAmount, String invoiceTemplateCode, String invoiceSeries) {}
    public record InvoiceView(UUID id, String status, String externalInvoiceId, String resultCode,
                              String resultMessage, String transactionId, String invoiceTemplateCode,
                              String invoiceSeries, String invoiceNumber, BigDecimal subtotal,
                              BigDecimal taxAmount, BigDecimal totalAmount, Instant createdAt,
                              Instant issuedAt, String taxAuthorityStatus, Instant lastSyncedAt,
                              int attemptCount, List<UUID> orderIds, String apiEnvironment,
                              String sellerTaxCode, String apiUsername) {}
    public record DownloadFile(String fileName, String contentType, String base64) {}
    public record ReleaseResult(List<UUID> releasedOrderIds, InvoiceView invoice) {}

    public ConfigView getConfig(UUID tenantId, UUID companyId) {
        return configRepository.findByTenantIdAndCompanyId(tenantId, companyId)
                .map(config -> view(config, true))
                .orElse(new ConfigView(false, false, VinHoadonEnvironment.PRODUCTION.name(),
                        properties.isEnabled(), cipher.isConfigured(),
                        "", "", false, "", "", 8, true, "", "", "", ""));
    }

    @Transactional
    public ConfigView saveConfig(UUID tenantId, UUID companyId, ConfigRequest request) {
        if (request == null) throw new IllegalArgumentException("Configuration is required");
        String taxCode = required(request.taxCode(), "Seller tax code", 14);
        if (!TAX_CODE.matcher(taxCode).matches())
            throw new IllegalArgumentException("Seller tax code must contain 10 digits, optionally followed by a 3-digit branch code");
        String username = required(request.apiUsername(), "VIN-HOADON username", 255);

        VinHoadonCompanyConfig config = configRepository.findByTenantIdAndCompanyId(tenantId, companyId)
                .orElseGet(VinHoadonCompanyConfig::new);
        if (config.getId() == null) {
            config.setTenantId(tenantId);
            config.setCompanyId(companyId);
        }
        String apiEnvironment = request.apiEnvironment() == null
                ? VinHoadonEnvironment.from(config.getApiEnvironment()).name()
                : VinHoadonEnvironment.from(request.apiEnvironment()).name();

        // New clients send both typed series, old clients can still update the legacy default.
        // A blank typed field explicitly clears it; an omitted typed field preserves its value.
        boolean typedUpdate = request.posInvoiceTemplateCode() != null || request.posInvoiceSeries() != null
                || request.normalInvoiceTemplateCode() != null || request.normalInvoiceSeries() != null;
        String posTemplate = request.posInvoiceTemplateCode() == null
                ? config.getPosInvoiceTemplateCode() : trim(request.posInvoiceTemplateCode());
        String posSeries = request.posInvoiceSeries() == null
                ? config.getPosInvoiceSeries() : trim(request.posInvoiceSeries());
        String normalTemplate = request.normalInvoiceTemplateCode() == null
                ? config.getNormalInvoiceTemplateCode() : trim(request.normalInvoiceTemplateCode());
        String normalSeries = request.normalInvoiceSeries() == null
                ? config.getNormalInvoiceSeries() : trim(request.normalInvoiceSeries());
        if (typedUpdate) {
            validateTypedPair("POS", posTemplate, posSeries);
            validateTypedPair("NORMAL", normalTemplate, normalSeries);
            if (posSeries == null && normalSeries == null)
                throw new IllegalArgumentException("Cần cấu hình ít nhất một loại hóa đơn: máy tính tiền hoặc thông thường.");
        }

        String legacyTemplate = trim(request.invoiceTemplateCode());
        String legacySeries = trim(request.invoiceSeries());
        if (legacyTemplate == null && config.getInvoiceTemplateCode() != null)
            legacyTemplate = config.getInvoiceTemplateCode();
        if (legacySeries == null && config.getInvoiceSeries() != null)
            legacySeries = config.getInvoiceSeries();
        if (legacyTemplate == null || legacySeries == null) {
            legacyTemplate = posSeries != null ? posTemplate : normalTemplate;
            legacySeries = posSeries != null ? posSeries : normalSeries;
        }
        legacyTemplate = required(legacyTemplate, "Invoice template code", 11);
        legacySeries = required(legacySeries, "Invoice series", 8);
        if (legacyTemplate.equalsIgnoreCase(legacySeries))
            throw new IllegalArgumentException("Mã mẫu hóa đơn là cột Mẫu số, không phải Ký hiệu.");

        int vat = request.defaultVatRate() == null ? 8 : request.defaultVatRate();
        validateVat(vat);
        if (request.apiPassword() != null && !request.apiPassword().isBlank()) {
            config.setEncryptedApiPassword(cipher.encrypt(request.apiPassword(), tenantId, companyId));
        } else if (config.getEncryptedApiPassword() == null) {
            throw new IllegalArgumentException("VIN-HOADON API password is required for initial setup");
        }
        config.setEnabled(request.enabled());
        config.setApiEnvironment(apiEnvironment);
        config.setTaxCode(taxCode);
        config.setApiUsername(username);
        config.setInvoiceTemplateCode(legacyTemplate);
        config.setInvoiceSeries(legacySeries);
        if (typedUpdate) {
            config.setPosInvoiceTemplateCode(posTemplate);
            config.setPosInvoiceSeries(posSeries);
            config.setNormalInvoiceTemplateCode(normalTemplate);
            config.setNormalInvoiceSeries(normalSeries);
        }
        config.setDefaultVatRate(vat);
        config.setPricesIncludeVat(!Boolean.FALSE.equals(request.pricesIncludeVat()));
        return view(configRepository.save(config), true);
    }

    static void validateTypedPair(String type, String template, String series) {
        if (template == null && series == null) return; // A company can register only one type.
        if (template == null || series == null)
            throw new IllegalArgumentException("Mẫu số và Ký hiệu của " + type + " phải đi cùng nhau.");
        if (template.length() > 11 || template.equalsIgnoreCase(series))
            throw new IllegalArgumentException("Mã mẫu số không hợp lệ cho " + type);
        // VIN-HOADON is the source of truth for a registered series. In
        // particular, some accounts return the leading invoice-form digit as
        // part of the series (for example 2C26MAM), while others return C26MAM.
        // Do not infer the invoice type or restrict the vendor's character format.
        if (series.length() > 8)
            throw new IllegalArgumentException("Ký hiệu " + type + " không hợp lệ: " + series);
    }

    static void requireCurrentYear(String series) {
        String year = String.format(Locale.ROOT, "%02d", Year.now(ZoneId.of("Asia/Ho_Chi_Minh")).getValue() % 100);
        var match = STANDARD_SERIES_YEAR.matcher(series);
        // Only enforce the year when the value follows a recognized standard
        // shape. Custom VIN-HOADON series are passed through unchanged.
        if (match.find() && !match.group(1).equals(year)) {
            throw new IllegalStateException("Ký hiệu " + series
                    + " không thuộc năm hiện tại (20" + year + "). Hãy cập nhật ký hiệu đã đăng ký trên VIN-HOADON.");
        }
    }

    public Preview preview(UUID tenantId, UUID companyId, IssueRequest request) {
        VinHoadonCompanyConfig config = requireUsableConfig(tenantId, companyId);
        TemplateOption template = selectedTemplate(request, config);
        return withItemNames(buildPreview(loadEligibleOrders(tenantId, companyId, request), config,
                requestedVat(request, config), requestedPayment(request), template, invoicePricesIncludeVat(request)), request.itemNames());
    }

    public List<TemplateOption> templates(UUID tenantId, UUID companyId) {
        return announcedTemplates(requireUsableConfig(tenantId, companyId));
    }

    public InvoiceView issue(UUID tenantId, UUID companyId, IssueRequest request, String actor, ZoneId zoneId) {
        VinHoadonCompanyConfig config = requireUsableConfig(tenantId, companyId);
        requireAnnouncedTemplate(config, selectedTemplate(request, config));
        UUID invoiceId = transactions.execute(status -> prepareIssue(tenantId, companyId, request, actor, zoneId));
        return submit(tenantId, companyId, invoiceId);
    }

    private UUID prepareIssue(UUID tenantId, UUID companyId, IssueRequest request, String actor, ZoneId zoneId) {
        VinHoadonCompanyConfig config = requireUsableConfig(tenantId, companyId);
        List<UUID> ids = normalizedIds(request);
        List<ShopOrder> orders = orderRepository.lockAllForInvoice(ids, tenantId, companyId);
        validateOrders(ids, orders);
        rejectAlreadyInvoiced(ids);
        TemplateOption template = selectedTemplate(request, config);
        Preview preview = withItemNames(buildPreview(orders, config, requestedVat(request, config), requestedPayment(request), template, invoicePricesIncludeVat(request)),
                request.itemNames());

        VinHoadonShopInvoice invoice = new VinHoadonShopInvoice();
        invoice.setTenantId(tenantId);
        invoice.setCompanyId(companyId);
        invoice.setExternalInvoiceId(newExternalInvoiceId());
        invoice.setStatus("ISSUING");
        invoice.setAttemptCount(1);
        invoice.setLastAttemptAt(Instant.now());
        copyBuyer(invoice, request);
        invoice.setPaymentMethod(preview.paymentMethod());
        invoice.setVatRate(preview.vatRate());
        invoice.setSubtotal(preview.subtotal());
        invoice.setTaxAmount(preview.taxAmount());
        invoice.setTotalAmount(preview.totalAmount());
        invoice.setCreatedBy(trim(actor));
        invoice.setInvoiceTemplateCode(template.templateCode());
        invoice.setInvoiceSeries(template.series());
        invoice.setApiEnvironment(VinHoadonEnvironment.from(config.getApiEnvironment()).name());
        invoice.setSellerTaxCode(config.getTaxCode());
        invoice.setApiUsername(config.getApiUsername());
        invoiceRepository.saveAndFlush(invoice);
        for (ShopOrder order : orders) {
            VinHoadonShopInvoiceOrder link = new VinHoadonShopInvoiceOrder();
            link.setInvoice(invoice); link.setOrder(order); link.setTenantId(tenantId); link.setCompanyId(companyId);
            linkRepository.save(link);
        }
        linkRepository.flush();

        ObjectNode payload = payload(invoice, request, preview, config, zoneId == null ? ZoneId.of("Asia/Ho_Chi_Minh") : zoneId);
        invoice.setRequestPayload(mapper.convertValue(payload, Map.class));
        invoiceRepository.save(invoice);
        return invoice.getId();
    }

    public InvoiceView retry(UUID tenantId, UUID companyId, UUID invoiceId, RetryRequest request) {
        VinHoadonShopInvoice existing = requireInvoice(tenantId, companyId, invoiceId);
        String requestedType = request == null ? null : trim(request.invoiceType());
        if (!"PENDING".equals(existing.getStatus())) {
            VinHoadonCompanyConfig config = requireUsableConfig(tenantId, companyId);
            TemplateOption retryTemplate = requestedType == null
                    ? new TemplateOption(existing.getInvoiceTemplateCode(), existing.getInvoiceSeries(), null)
                    : selectedTemplate(requestedType, null, config);
            requireAnnouncedTemplate(config, retryTemplate);
        }
        String previousStatus = transactions.execute(status -> {
            VinHoadonShopInvoice invoice = invoiceRepository.findWithLockByIdAndTenantIdAndCompanyId(invoiceId, tenantId, companyId)
                    .orElseThrow(() -> new NoSuchElementException("VIN-HOADON invoice not found"));
            String current = invoice.getStatus();
            if ("PENDING".equals(current)) return current;
            if ("ISSUING".equals(current) && invoice.getLastAttemptAt() != null
                    && invoice.getLastAttemptAt().isAfter(Instant.now().minus(Duration.ofMinutes(2))))
                throw new IllegalStateException("Invoice submission is still in progress");
            if (!Set.of("FAILED", "RECONCILE", "ISSUING").contains(current))
                throw new IllegalStateException("This invoice cannot be retried");
            Map<String, Object> refreshedPayload = null;
            VinHoadonCompanyConfig config = requireUsableConfig(tenantId, companyId);
            VinHoadonEnvironment configuredEnvironment = VinHoadonEnvironment.from(config.getApiEnvironment());
            boolean environmentChanged = invoiceEnvironment(invoice) != configuredEnvironment;
            boolean accountChanged = !Objects.equals(trim(invoice.getSellerTaxCode()), trim(config.getTaxCode()))
                    || !Objects.equals(trim(invoice.getApiUsername()), trim(config.getApiUsername()));
            if ((environmentChanged || accountChanged) && !canSwitchEnvironmentOnRetry(current))
                throw new IllegalStateException("Only a definitively FAILED invoice can switch VIN-HOADON environment or account; reconcile this invoice with its original configuration");
            if (environmentChanged || accountChanged) {
                invoice.setApiEnvironment(configuredEnvironment.name());
                invoice.setSellerTaxCode(config.getTaxCode());
                invoice.setApiUsername(config.getApiUsername());
            }
            String invoiceType = request == null ? null : trim(request.invoiceType());
            if (invoiceType != null) {
                TemplateOption template = selectedTemplate(invoiceType, null, config);
                invoice.setInvoiceTemplateCode(template.templateCode());
                invoice.setInvoiceSeries(template.series());
                refreshedPayload = new LinkedHashMap<>(Optional.ofNullable(invoice.getRequestPayload()).orElse(Map.of()));
                refreshedPayload.put("mauso", template.templateCode());
                refreshedPayload.put("kyhieu", template.series());
            }
            if ("FAILED".equals(current)) {
                // A definitive vendor rejection was not accepted as an invoice.
                // Use a fresh application id so the corrected payload is treated
                // as a new submission. Never do this for uncertain/reconcile states.
                String externalInvoiceId = newExternalInvoiceId();
                invoice.setExternalInvoiceId(externalInvoiceId);
                refreshedPayload = refreshFailedPayload(
                        refreshedPayload == null ? invoice.getRequestPayload() : refreshedPayload,
                        externalInvoiceId, config.getTaxCode());
            }
            if (refreshedPayload != null) invoice.setRequestPayload(refreshedPayload);
            invoice.setStatus("ISSUING");
            invoice.setLastAttemptAt(Instant.now());
            invoice.setAttemptCount(invoice.getAttemptCount() + 1);
            return current;
        });
        if ("PENDING".equals(previousStatus)) return sync(tenantId, companyId, invoiceId);
        return submit(tenantId, companyId, invoiceId);
    }

    private void requireAnnouncedTemplate(VinHoadonCompanyConfig config, TemplateOption selected) {
        if (!isAnnouncedTemplate(announcedTemplates(config), selected)) {
            throw new IllegalStateException("Mẫu số " + selected.templateCode() + " và Ký hiệu "
                    + selected.series() + " chưa đăng ký cho tài khoản VIN-HOADON này. "
                    + "Hãy chọn đúng cặp trong danh sách mẫu VIN-HOADON trước khi gửi.");
        }
    }

    static boolean isAnnouncedTemplate(List<TemplateOption> announced, TemplateOption selected) {
        if (selected == null || selected.templateCode() == null || selected.series() == null) return false;
        return Optional.ofNullable(announced).orElse(List.of()).stream().anyMatch(option ->
                selected.templateCode().equals(option.templateCode())
                        && selected.series().equals(option.series()));
    }

    static String newExternalInvoiceId() {
        return "SO" + UUID.randomUUID().toString().replace("-", "");
    }

    static boolean canSwitchEnvironmentOnRetry(String status) {
        return "FAILED".equals(status);
    }

    static boolean isConfirmedAbsentResult(String resultCode) {
        return "11".equals(resultCode) || "37".equals(resultCode);
    }

    static Map<String, Object> refreshFailedPayload(Map<String, Object> payload,
                                                     String externalInvoiceId, String sellerTaxCode) {
        Map<String, Object> refreshed = new LinkedHashMap<>(Optional.ofNullable(payload).orElse(Map.of()));
        refreshed.put("ma_hoadon", externalInvoiceId);
        refreshed.put("doanhnghiep_mst", sellerTaxCode);
        return refreshed;
    }

    public InvoiceView sync(UUID tenantId, UUID companyId, UUID invoiceId) {
        VinHoadonShopInvoice invoice = requireInvoice(tenantId, companyId, invoiceId);
        VinHoadonCompanyConfig config = requireUsableConfig(tenantId, companyId);
        JsonNode response = client.lookupInvoice(new VinHoadonClient.InvoiceReference(
                invoice.getVendorTransactionId(), invoice.getExternalInvoiceId()), credentials(config, invoiceEnvironment(invoice)));
        return transactions.execute(status -> {
            VinHoadonShopInvoice current = invoiceRepository.findWithLockByIdAndTenantIdAndCompanyId(invoiceId, tenantId, companyId)
                    .orElseThrow(() -> new NoSuchElementException("VIN-HOADON invoice not found"));
            if (lookupMatches(current, response)) applyVendorResponse(current, response);
            else if (!"ISSUED".equals(current.getStatus())) current.setStatus("RECONCILE");
            current.setLastSyncedAt(Instant.now());
            return toView(current);
        });
    }

    public ReleaseResult releaseRemovedDemoInvoice(UUID tenantId, UUID companyId, UUID invoiceId) {
        VinHoadonShopInvoice invoice = requireInvoice(tenantId, companyId, invoiceId);
        if (invoiceEnvironment(invoice) != VinHoadonEnvironment.DEMO)
            throw new IllegalStateException("Only DEMO invoices can be released after removal; production invoices require the legal cancellation/replacement workflow");
        if (!Set.of("ISSUED", "DRAFT", "PENDING").contains(invoice.getStatus()))
            throw new IllegalStateException("Only a successfully submitted DEMO invoice can be checked and released");
        VinHoadonCompanyConfig config = requireUsableConfig(tenantId, companyId);
        if ((trim(invoice.getSellerTaxCode()) != null && !Objects.equals(trim(invoice.getSellerTaxCode()), trim(config.getTaxCode())))
                || (trim(invoice.getApiUsername()) != null && !Objects.equals(trim(invoice.getApiUsername()), trim(config.getApiUsername()))))
            throw new IllegalStateException("Restore the VIN account originally used by this invoice before confirming its removal");

        JsonNode lookup = client.lookupInvoice(new VinHoadonClient.InvoiceReference(
                invoice.getVendorTransactionId(), invoice.getExternalInvoiceId()),
                credentials(config, invoiceEnvironment(invoice)));
        if (lookupMatches(invoice, lookup))
            throw new IllegalStateException("Invoice still exists in VIN-HOADON and cannot be released");
        String resultCode = text(lookup, "maketqua");
        if (!isConfirmedAbsentResult(resultCode))
            throw new IllegalStateException("VIN-HOADON did not confirm that the invoice was removed; result "
                    + Optional.ofNullable(resultCode).orElse("unknown"));

        return transactions.execute(status -> {
            VinHoadonShopInvoice current = invoiceRepository.findWithLockByIdAndTenantIdAndCompanyId(invoiceId, tenantId, companyId)
                    .orElseThrow(() -> new NoSuchElementException("VIN-HOADON invoice not found"));
            if (!Set.of("ISSUED", "DRAFT", "PENDING").contains(current.getStatus()))
                throw new IllegalStateException("Invoice status changed; reload before releasing it");
            List<VinHoadonShopInvoiceOrder> links = linkRepository.findAllByInvoice_Id(invoiceId);
            List<UUID> releasedOrderIds = links.stream().map(link -> link.getOrder().getId()).toList();
            linkRepository.deleteAll(links);
            linkRepository.flush();
            current.setStatus("CANCELLED");
            current.setVendorResultCode(resultCode);
            current.setVendorResultMessage("Confirmed absent from VIN-HOADON DEMO; orders released for reissue");
            current.setResponsePayload(mapper.convertValue(lookup, Map.class));
            current.setLastSyncedAt(Instant.now());
            return new ReleaseResult(releasedOrderIds, toView(current));
        });
    }

    private InvoiceView submit(UUID tenantId, UUID companyId, UUID invoiceId) {
        VinHoadonShopInvoice invoice = requireInvoice(tenantId, companyId, invoiceId);
        VinHoadonCompanyConfig config = requireUsableConfig(tenantId, companyId);
        VinHoadonCredentials credentials = credentials(config, invoiceEnvironment(invoice));
        if (invoice.getAttemptCount() > 1) {
            try {
                JsonNode lookup = client.lookupInvoice(new VinHoadonClient.InvoiceReference(
                        null, invoice.getExternalInvoiceId()), credentials);
                if (lookupMatches(invoice, lookup)) return recordSendResponse(tenantId, companyId, invoiceId, lookup);
                if (!Set.of("11", "37").contains(text(lookup, "maketqua")))
                    return recordUncertain(tenantId, companyId, invoiceId, "VIN-HOADON lookup did not confirm whether the invoice was issued");
            } catch (RuntimeException exception) {
                return recordUncertain(tenantId, companyId, invoiceId, safeMessage(exception));
            }
        }
        try {
            return recordSendResponse(tenantId, companyId, invoiceId,
                    client.sendOriginal(mapper.valueToTree(invoice.getRequestPayload()), credentials));
        } catch (RuntimeException exception) {
            return recordUncertain(tenantId, companyId, invoiceId, safeMessage(exception));
        }
    }

    private InvoiceView recordSendResponse(UUID tenantId, UUID companyId, UUID invoiceId, JsonNode response) {
        return transactions.execute(status -> {
            VinHoadonShopInvoice invoice = invoiceRepository.findWithLockByIdAndTenantIdAndCompanyId(invoiceId, tenantId, companyId)
                    .orElseThrow(() -> new NoSuchElementException("VIN-HOADON invoice not found"));
            applySendResponse(invoice, response);
            return toView(invoice);
        });
    }

    void applySendResponse(VinHoadonShopInvoice invoice, JsonNode response) {
        applyVendorResponse(invoice, response);
        if ("PENDING".equals(invoice.getStatus()) && text(response, "trangthai") == null)
            invoice.setStatus("DRAFT");
    }

    private InvoiceView recordUncertain(UUID tenantId, UUID companyId, UUID invoiceId, String message) {
        return transactions.execute(status -> {
            VinHoadonShopInvoice invoice = invoiceRepository.findWithLockByIdAndTenantIdAndCompanyId(invoiceId, tenantId, companyId)
                    .orElseThrow(() -> new NoSuchElementException("VIN-HOADON invoice not found"));
            invoice.setStatus("RECONCILE");
            invoice.setVendorResultMessage(message);
            return toView(invoice);
        });
    }

    public InvoiceView get(UUID tenantId, UUID companyId, UUID invoiceId) {
        return toView(requireInvoice(tenantId, companyId, invoiceId));
    }

    public Map<UUID, InvoiceView> statuses(UUID tenantId, UUID companyId, Collection<UUID> orderIds) {
        if (orderIds == null || orderIds.isEmpty()) return Map.of();
        Map<UUID, InvoiceView> result = new LinkedHashMap<>();
        for (VinHoadonShopInvoiceOrder link : linkRepository.findAllByOrder_IdIn(orderIds)) {
            if (tenantId.equals(link.getTenantId()) && companyId.equals(link.getCompanyId())) {
                result.put(link.getOrder().getId(), toView(link.getInvoice()));
            }
        }
        return result;
    }

    public DownloadFile download(UUID tenantId, UUID companyId, UUID invoiceId, String format) {
        VinHoadonShopInvoice invoice = requireInvoice(tenantId, companyId, invoiceId);
        if (!"ISSUED".equals(invoice.getStatus())) throw new IllegalStateException("Invoice has not been issued");
        VinHoadonCompanyConfig config = requireUsableConfig(tenantId, companyId);
        var reference = new VinHoadonClient.InvoiceReference(invoice.getVendorTransactionId(), invoice.getExternalInvoiceId());
        boolean xml = "xml".equalsIgnoreCase(format);
        VinHoadonCredentials invoiceCredentials = credentials(config, invoiceEnvironment(invoice));
        JsonNode response = xml ? client.downloadSignedXml(reference, invoiceCredentials)
                : client.downloadSignedPdf(reference, invoiceCredentials);
        String field = xml ? "base64xml" : "base64pdf";
        String base64 = text(response, field);
        if (base64 == null) throw new IllegalStateException("VIN-HOADON did not return " + field);
        return new DownloadFile(invoice.getExternalInvoiceId() + (xml ? ".xml" : ".pdf"),
                xml ? "application/xml" : "application/pdf", base64);
    }

    private ConfigView view(VinHoadonCompanyConfig c, boolean configured) {
        String legacySeries = c.getInvoiceSeries();
        boolean legacyOnly = c.getPosInvoiceSeries() == null && c.getNormalInvoiceSeries() == null;
        boolean legacyPos = legacyOnly && legacySeries != null && legacySeries.matches("^[A-Z][0-9]{2}M[A-Z0-9]{2}$");
        boolean legacyNormal = legacyOnly && legacySeries != null && legacySeries.matches("^[A-Z][0-9]{2}T[A-Z0-9]{2}$");
        return new ConfigView(configured, c.isEnabled(), VinHoadonEnvironment.from(c.getApiEnvironment()).name(),
                properties.isEnabled(), cipher.isConfigured(), c.getTaxCode(),
                c.getApiUsername(), c.getEncryptedApiPassword() != null && !c.getEncryptedApiPassword().isBlank(),
                c.getInvoiceTemplateCode(), c.getInvoiceSeries(), c.getDefaultVatRate(), c.isPricesIncludeVat(),
                Optional.ofNullable(c.getPosInvoiceTemplateCode()).orElse(legacyPos ? c.getInvoiceTemplateCode() : ""),
                Optional.ofNullable(c.getPosInvoiceSeries()).orElse(legacyPos ? legacySeries : ""),
                Optional.ofNullable(c.getNormalInvoiceTemplateCode()).orElse(legacyNormal ? c.getInvoiceTemplateCode() : ""),
                Optional.ofNullable(c.getNormalInvoiceSeries()).orElse(legacyNormal ? legacySeries : ""));
    }

    private List<TemplateOption> announcedTemplates(VinHoadonCompanyConfig config) {
        JsonNode response = client.announcedTemplates(credentials(config));
        JsonNode rows = response.isArray() ? response : response.path("dsmauhoadon");
        if (!rows.isArray()) throw new IllegalStateException("VIN-HOADON did not return invoice templates");
        List<TemplateOption> options = new ArrayList<>();
        for (JsonNode row : rows) {
            if (row.isArray()) {
                for (JsonNode nested : row) addTemplate(options, nested, config.getTaxCode());
            } else addTemplate(options, row, config.getTaxCode());
        }
        return options.stream().distinct().toList();
    }

    private void addTemplate(List<TemplateOption> options, JsonNode row, String sellerTaxCode) {
        String taxCode = firstText(row, "doanhnghiep_mst", "doanhNghiep_Mst");
        if (taxCode != null && !sellerTaxCode.equals(taxCode)) return;
        String templateCode = text(row, "mauso");
        String series = text(row, "kyhieu");
        if (templateCode != null && series != null)
            options.add(new TemplateOption(templateCode, series, text(row, "ten")));
    }

    private TemplateOption selectedTemplate(IssueRequest request, VinHoadonCompanyConfig config) {
        return selectedTemplate(request == null ? null : trim(request.invoiceType()),
                request == null ? null : trim(request.invoiceSeries()), config);
    }

    private TemplateOption selectedTemplate(String invoiceType, String requestedSeries, VinHoadonCompanyConfig config) {
        if (invoiceType != null && !Set.of("POS", "NORMAL").contains(invoiceType))
            throw new IllegalArgumentException("Invoice type must be POS or NORMAL");

        String posSeries = trim(config.getPosInvoiceSeries());
        String posTemplate = trim(config.getPosInvoiceTemplateCode());
        String normalSeries = trim(config.getNormalInvoiceSeries());
        String normalTemplate = trim(config.getNormalInvoiceTemplateCode());
        // Previous company defaults are the fallback only before any typed pair is configured.
        boolean legacyOnly = posSeries == null && normalSeries == null;
        if (legacyOnly && posSeries == null && config.getInvoiceSeries() != null
                && config.getInvoiceSeries().matches("^[A-Z][0-9]{2}M[A-Z0-9]{2}$")) {
            posSeries = config.getInvoiceSeries();
            posTemplate = config.getInvoiceTemplateCode();
        }
        if (legacyOnly && normalSeries == null && config.getInvoiceSeries() != null
                && config.getInvoiceSeries().matches("^[A-Z][0-9]{2}T[A-Z0-9]{2}$")) {
            normalSeries = config.getInvoiceSeries();
            normalTemplate = config.getInvoiceTemplateCode();
        }

        if (invoiceType == null) {
            if (requestedSeries != null) {
                if (requestedSeries.equals(posSeries)) invoiceType = "POS";
                else if (requestedSeries.equals(normalSeries)) invoiceType = "NORMAL";
                else throw new IllegalArgumentException("Ký hiệu chưa được lưu trong cấu hình công ty.");
            } else {
                // Shop orders default to POS if registered, otherwise use the normal series.
                invoiceType = posSeries != null ? "POS" : "NORMAL";
            }
        }
        String selectedSeries = "POS".equals(invoiceType) ? posSeries : normalSeries;
        String selectedTemplate = "POS".equals(invoiceType) ? posTemplate : normalTemplate;
        if (selectedSeries == null || selectedTemplate == null)
            throw new IllegalStateException("Chưa cấu hình Mẫu số + Ký hiệu cho loại hóa đơn " + invoiceType);
        if (requestedSeries != null && !requestedSeries.equals(selectedSeries))
            throw new IllegalArgumentException("Ký hiệu phải khớp với loại hóa đơn " + invoiceType);
        validateTypedPair(invoiceType, selectedTemplate, selectedSeries);
        requireCurrentYear(selectedSeries);
        return new TemplateOption(selectedTemplate, selectedSeries, invoiceType.equals("POS") ? "Máy tính tiền" : "Thông thường");
    }

    private VinHoadonCompanyConfig requireUsableConfig(UUID tenantId, UUID companyId) {
        VinHoadonCompanyConfig config = configRepository.findByTenantIdAndCompanyId(tenantId, companyId)
                .orElseThrow(() -> new IllegalStateException("VIN-HOADON is not configured for this company"));
        if (!config.isEnabled()) throw new IllegalStateException("VIN-HOADON is disabled for this company");
        if (!properties.isEnabled()) throw new IllegalStateException("VIN-HOADON is disabled on this server (VIN_HOADON_ENABLED=false)");
        if (!cipher.isConfigured()) throw new IllegalStateException("VIN_HOADON_MASTER_KEY is not configured on this server");
        return config;
    }

    private List<ShopOrder> loadEligibleOrders(UUID tenantId, UUID companyId, IssueRequest request) {
        List<UUID> ids = normalizedIds(request);
        List<ShopOrder> orders = orderRepository.findAllById(ids).stream()
                .filter(o -> tenantId.equals(o.getTenantId()) && companyId.equals(o.getCompanyId())).toList();
        validateOrders(ids, orders);
        rejectAlreadyInvoiced(ids);
        return orders;
    }

    private void validateOrders(List<UUID> ids, List<ShopOrder> orders) {
        if (orders.size() != ids.size()) throw new IllegalArgumentException("One or more selected orders do not exist in this company");
        for (ShopOrder order : orders) {
            if (!ShopOrder.PAY_STATUS_PAID.equals(order.getPaymentStatus()))
                throw new IllegalStateException("Order " + order.getOrderCode() + " is not paid");
            if (!Set.of(ShopOrder.STATUS_COMPLETED, ShopOrder.STATUS_PICKED_UP).contains(order.getStatus()))
                throw new IllegalStateException("Order " + order.getOrderCode() + " must be completed or picked up");
        }
    }

    private void rejectAlreadyInvoiced(List<UUID> ids) {
        List<VinHoadonShopInvoiceOrder> existing = linkRepository.findAllByOrder_IdIn(ids);
        if (!existing.isEmpty()) throw new IllegalStateException("One or more selected orders already belong to VIN-HOADON invoice " + existing.get(0).getInvoice().getExternalInvoiceId());
    }

    private List<UUID> normalizedIds(IssueRequest request) {
        if (request == null || request.orderIds() == null) throw new IllegalArgumentException("Select at least one order");
        List<UUID> ids = request.orderIds().stream().filter(Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) throw new IllegalArgumentException("Select at least one order");
        if (ids.size() > 100) throw new IllegalArgumentException("A VIN-HOADON invoice can contain at most 100 shop orders");
        return ids;
    }

    record VatAmounts(BigDecimal subtotal, BigDecimal tax, BigDecimal total) {}

    static VatAmounts calculateVat(BigDecimal allocated, int vat, boolean pricesIncludeVat) {
        if (vat <= 0) return new VatAmounts(allocated, BigDecimal.ZERO, allocated);
        if (pricesIncludeVat) {
            BigDecimal subtotal = allocated.multiply(BigDecimal.valueOf(100))
                    .divide(BigDecimal.valueOf(100L + vat), 6, RoundingMode.HALF_UP);
            return new VatAmounts(subtotal, allocated.subtract(subtotal), allocated);
        }
        BigDecimal tax = allocated.multiply(BigDecimal.valueOf(vat))
                .divide(BigDecimal.valueOf(100), 6, RoundingMode.HALF_UP);
        return new VatAmounts(allocated, tax, allocated.add(tax));
    }

    private Preview buildPreview(List<ShopOrder> orders, VinHoadonCompanyConfig config, int vat, int paymentMethod,
                                 TemplateOption template, boolean pricesIncludeVat) {
        List<UUID> ids = orders.stream().map(ShopOrder::getId).toList();
        List<ShopOrderItem> items = itemRepository.findAllByOrderIds(ids);
        List<SourceLine> sources = new ArrayList<>();
        for (ShopOrderItem item : items) {
            if (item.getQuantity() == null || item.getQuantity().signum() <= 0) continue;
            String code = item.getModel() != null && item.getModel().getModelCode() != null
                    ? item.getModel().getModelCode() : "";
            String name = Optional.ofNullable(item.getModelName()).filter(s -> !s.isBlank()).orElse("Sản phẩm");
            if (item.getSelectedOptions() != null && !item.getSelectedOptions().isBlank() && !"{}".equals(item.getSelectedOptions()))
                name += " (" + item.getSelectedOptions() + ")";
            sources.add(new SourceLine(item.getId().toString(), code, truncate(name, 255), "cái", item.getQuantity(), nz(item.getLineTotal())));
        }
        for (ShopOrder order : orders) {
            if (nz(order.getDeliveryFee()).signum() > 0)
                sources.add(new SourceLine("delivery:" + order.getId(), "DELIVERY", "Phí giao hàng " + order.getOrderCode(), "lần", BigDecimal.ONE, order.getDeliveryFee()));
        }
        BigDecimal sourceTotal = sources.stream().map(SourceLine::total).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal payable = orders.stream().map(o -> nz(o.getTotalAmount()).subtract(nz(o.getDiscountAmount())).max(BigDecimal.ZERO))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        if (sourceTotal.signum() <= 0 || payable.signum() <= 0) throw new IllegalStateException("Selected orders have no positive invoice amount");
        BigDecimal factor = payable.divide(sourceTotal, 12, RoundingMode.HALF_UP);

        List<PreviewLine> lines = new ArrayList<>();
        BigDecimal used = BigDecimal.ZERO;
        for (int i = 0; i < sources.size(); i++) {
            SourceLine source = sources.get(i);
            BigDecimal allocated = i == sources.size() - 1
                    ? payable.subtract(used) : source.total().multiply(factor).setScale(6, RoundingMode.HALF_UP);
            used = used.add(allocated);
            VatAmounts calculated = calculateVat(allocated, vat, pricesIncludeVat);
            BigDecimal subtotal = calculated.subtotal();
            BigDecimal tax = calculated.tax();
            BigDecimal total = calculated.total();
            lines.add(new PreviewLine(source.lineId(), source.code(), source.name(), source.unit(), source.quantity(),
                    subtotal.divide(source.quantity(), 6, RoundingMode.HALF_UP), subtotal, tax, total, vat));
        }
        BigDecimal subtotal = lines.stream().map(PreviewLine::subtotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal tax = lines.stream().map(PreviewLine::taxAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal total = lines.stream().map(PreviewLine::total).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal expectedTotal = pricesIncludeVat || vat <= 0 ? payable : payable.add(tax);
        if (total.subtract(expectedTotal).abs().compareTo(new BigDecimal("0.01")) > 0)
            throw new IllegalStateException("Invoice VAT calculation differs from the selected price basis");
        List<PreviewOrder> summary = orders.stream().sorted(Comparator.comparing(ShopOrder::getCreatedAt))
                .map(o -> new PreviewOrder(o.getId(), o.getOrderCode(), o.getOrderNumber(),
                        nz(o.getTotalAmount()).subtract(nz(o.getDiscountAmount())).max(BigDecimal.ZERO))).toList();
        return new Preview(summary, lines, paymentMethod, vat, pricesIncludeVat, subtotal, tax, total,
                template.templateCode(), template.series());
    }

    Preview withItemNames(Preview preview, Map<String, String> itemNames) {
        if (itemNames == null || itemNames.isEmpty()) return preview;
        Set<String> matched = new HashSet<>();
        List<PreviewLine> lines = new ArrayList<>(preview.lines().size());
        for (PreviewLine line : preview.lines()) {
            String name = line.name();
            if (itemNames.containsKey(line.lineId())) {
                name = required(itemNames.get(line.lineId()), "Invoice item name", 255);
                if (name.chars().anyMatch(ch -> Character.isISOControl(ch)))
                    throw new IllegalArgumentException("Invoice item name cannot contain control characters");
                matched.add(line.lineId());
            }
            lines.add(new PreviewLine(line.lineId(), line.code(), name, line.unit(), line.quantity(),
                    line.unitPriceBeforeTax(), line.subtotal(), line.taxAmount(), line.total(), line.vatRate()));
        }
        if (matched.size() != itemNames.size())
            throw new IllegalArgumentException("Invoice item name does not match a selected order item");
        return new Preview(preview.orders(), lines, preview.paymentMethod(), preview.vatRate(),
                preview.pricesIncludeVat(), preview.subtotal(), preview.taxAmount(), preview.totalAmount(),
                preview.invoiceTemplateCode(), preview.invoiceSeries());
    }

    private ObjectNode payload(VinHoadonShopInvoice invoice, IssueRequest request, Preview preview,
                               VinHoadonCompanyConfig config, ZoneId zoneId) {
        ObjectNode root = mapper.createObjectNode();
        root.put("mtt_nguoiban_ky", 1);
        root.put("doanhnghiep_mst", config.getTaxCode());
        root.put("mauso", invoice.getInvoiceTemplateCode());
        root.put("kyhieu", invoice.getInvoiceSeries());
        root.put("sophieu", preview.orders().stream().map(PreviewOrder::orderCode).limit(5).reduce((a, b) -> a + "," + b).orElse(""));
        root.put("ma_hoadon", invoice.getExternalInvoiceId());
        root.put("ngaylap", VIN_DATE.format(ZonedDateTime.now(zoneId)));
        put(root, "dnmua_mst", request.buyerTaxCode());
        put(root, "dnmua_ten", request.buyerOrganizationName());
        put(root, "dnmua_tennguoimua", request.buyerName());
        put(root, "dnmua_diachi", request.buyerAddress());
        put(root, "dnmua_sdt", request.buyerPhone());
        put(root, "dnmua_email", request.buyerEmail());
        root.put("thanhtoan_phuongthuc", preview.paymentMethod());
        root.put("thanhtoan_phuongthuc_ten", paymentName(preview.paymentMethod()));
        root.put("tiente_ma", "VND"); root.put("tygiangoaite", 1); root.put("tongtien_chietkhau", 0);
        root.put("tongtien_chuavat", preview.subtotal()); root.put("tienthue", preview.taxAmount());
        root.put("tongtien_covat", preview.totalAmount()); root.put("nguoilap", Optional.ofNullable(invoice.getCreatedBy()).orElse("system"));
        ArrayNode details = root.putArray("dschitiet");
        int index = 1;
        for (PreviewLine line : preview.lines()) {
            ObjectNode detail = details.addObject();
            detail.put("stt", index++); detail.put("hanghoa_loai", 0); detail.put("khuyenmai", 0);
            detail.put("ma", truncate(line.code(), 50)); detail.put("ten", truncate(line.name(), 255));
            detail.put("donvitinh", line.unit()); detail.put("soluong", line.quantity());
            detail.put("dongia", line.unitPriceBeforeTax()); detail.put("tongtien_chuathue", line.subtotal());
            detail.put("mathue", String.valueOf(line.vatRate())); detail.put("tongtien_thue", line.taxAmount());
            detail.put("tongtien_cothue", line.total());
        }
        ObjectNode tax = root.putArray("dsthuesuat").addObject();
        tax.put("mathue", String.valueOf(preview.vatRate())); tax.put("tongtien_chiuthue", preview.subtotal());
        tax.put("tongtien_thue", preview.taxAmount());
        return root;
    }

    void applyVendorResponse(VinHoadonShopInvoice invoice, JsonNode response) {
        invoice.setResponsePayload(mapper.convertValue(response, Map.class));
        invoice.setVendorResultCode(text(response, "maketqua"));
        invoice.setVendorResultMessage(text(response, "motaketqua"));
        invoice.setVendorTransactionId(firstTextOr(invoice.getVendorTransactionId(), response, "magiaodich", "ma_giaodich"));
        invoice.setInvoiceTemplateCode(firstTextOr(invoice.getInvoiceTemplateCode(), response, "mauso"));
        invoice.setInvoiceSeries(firstTextOr(invoice.getInvoiceSeries(), response, "kyhieu"));
        invoice.setInvoiceNumber(firstTextOr(invoice.getInvoiceNumber(), response, "sohoadon", "so_hoadon"));
        invoice.setTaxAuthorityStatus(firstTextOr(invoice.getTaxAuthorityStatus(), response, "trangthaicqt"));
        if ("01".equals(text(response, "maketqua"))) {
            boolean signed = "3".equals(text(response, "trangthai"))
                    || firstText(response, "sohoadon", "so_hoadon") != null;
            String vendorStatus = text(response, "trangthai");
            invoice.setStatus(signed ? "ISSUED" : "0".equals(vendorStatus) ? "DRAFT" : "PENDING");
            if (signed && invoice.getIssuedAt() == null) invoice.setIssuedAt(Instant.now());
        } else if ("03".equals(text(response, "maketqua"))) invoice.setStatus("RECONCILE");
        else invoice.setStatus("FAILED");
    }

    boolean lookupMatches(VinHoadonShopInvoice invoice, JsonNode response) {
        if (!"01".equals(text(response, "maketqua"))) return false;
        String externalId = firstText(response, "ma_hoadon", "mahoadon");
        String transactionId = firstText(response, "magiaodich", "ma_giaodich");
        if (externalId != null) return invoice.getExternalInvoiceId().equals(externalId);
        return invoice.getVendorTransactionId() != null && invoice.getVendorTransactionId().equals(transactionId);
    }
    private InvoiceView toView(VinHoadonShopInvoice invoice) {
        List<UUID> ids = linkRepository.findAllByInvoice_Id(invoice.getId()).stream().map(l -> l.getOrder().getId()).toList();
        return new InvoiceView(invoice.getId(), invoice.getStatus(), invoice.getExternalInvoiceId(), invoice.getVendorResultCode(),
                invoice.getVendorResultMessage(), invoice.getVendorTransactionId(), invoice.getInvoiceTemplateCode(),
                invoice.getInvoiceSeries(), invoice.getInvoiceNumber(), invoice.getSubtotal(), invoice.getTaxAmount(),
                invoice.getTotalAmount(), invoice.getCreatedAt(), invoice.getIssuedAt(),
                invoice.getTaxAuthorityStatus(), invoice.getLastSyncedAt(), invoice.getAttemptCount(), ids,
                invoiceEnvironment(invoice).name(), invoice.getSellerTaxCode(), invoice.getApiUsername());
    }
    private VinHoadonShopInvoice requireInvoice(UUID tenantId, UUID companyId, UUID id) {
        return invoiceRepository.findByIdAndTenantIdAndCompanyId(id, tenantId, companyId)
                .orElseThrow(() -> new NoSuchElementException("VIN-HOADON invoice not found"));
    }
    private VinHoadonCredentials credentials(VinHoadonCompanyConfig config) {
        return credentials(config, VinHoadonEnvironment.from(config.getApiEnvironment()));
    }
    private VinHoadonCredentials credentials(VinHoadonCompanyConfig config, VinHoadonEnvironment environment) {
        return new VinHoadonCredentials(config.getTaxCode(), config.getApiUsername(),
                cipher.decrypt(config.getEncryptedApiPassword(), config.getTenantId(), config.getCompanyId()), environment);
    }
    private VinHoadonEnvironment invoiceEnvironment(VinHoadonShopInvoice invoice) {
        return VinHoadonEnvironment.from(invoice.getApiEnvironment());
    }
    // Per-invoice choice independent of the company's historical default.
    // Legacy clients that omit it use VAT-inclusive prices, the shop-POS default.
    static boolean invoicePricesIncludeVat(IssueRequest request) {
        return request == null || !Boolean.FALSE.equals(request.pricesIncludeVat());
    }

    private int requestedVat(IssueRequest request, VinHoadonCompanyConfig config) {
        int value = request != null && request.vatRate() != null ? request.vatRate() : config.getDefaultVatRate(); validateVat(value); return value;
    }
    private int requestedPayment(IssueRequest request) {
        int value = request != null && request.paymentMethod() != null ? request.paymentMethod() : 3;
        if (value < 1 || value > 5) throw new IllegalArgumentException("Payment method must be from 1 to 5"); return value;
    }
    private void validateVat(int value) { if (!VAT_RATES.contains(value)) throw new IllegalArgumentException("VAT rate must be -2, -1, 0, 5, 8, or 10"); }
    private void copyBuyer(VinHoadonShopInvoice i, IssueRequest r) {
        String taxCode = trim(r.buyerTaxCode());
        if (taxCode != null && !TAX_CODE.matcher(taxCode).matches())
            throw new IllegalArgumentException("Buyer tax code must contain 10 digits, optionally followed by a 3-digit branch code");
        if (taxCode != null && (trim(r.buyerOrganizationName()) == null || trim(r.buyerAddress()) == null))
            throw new IllegalArgumentException("Buyer organization name and address are required when a tax code is supplied");
        if (trim(r.buyerOrganizationName()) == null && trim(r.buyerName()) == null)
            throw new IllegalArgumentException("Buyer name or organization name is required");
        if (trim(r.buyerEmail()) != null && !r.buyerEmail().contains("@"))
            throw new IllegalArgumentException("Buyer email is invalid");
        i.setBuyerTaxCode(trim(r.buyerTaxCode())); i.setBuyerOrganizationName(trim(r.buyerOrganizationName()));
        i.setBuyerName(trim(r.buyerName())); i.setBuyerAddress(trim(r.buyerAddress())); i.setBuyerPhone(trim(r.buyerPhone())); i.setBuyerEmail(trim(r.buyerEmail()));
    }
    private String paymentName(int value) { return switch (value) { case 1 -> "Tiền mặt"; case 2 -> "Chuyển khoản"; case 3 -> "Tiền mặt/Chuyển khoản"; case 4 -> "Thẻ tín dụng"; default -> "Đối trừ công nợ"; }; }
    private static BigDecimal nz(BigDecimal value) { return value == null ? BigDecimal.ZERO : value; }
    private static String required(String value, String label, int max) { String v = trim(value); if (v == null) throw new IllegalArgumentException(label + " is required"); if (v.length() > max) throw new IllegalArgumentException(label + " is too long"); return v; }
    private static String trim(String value) { return value == null || value.trim().isEmpty() ? null : value.trim(); }
    private static String truncate(String value, int max) { String v = value == null ? "" : value; return v.length() <= max ? v : v.substring(0, max); }
    private static void put(ObjectNode node, String name, String value) { node.put(name, Optional.ofNullable(trim(value)).orElse("")); }
    private static String text(JsonNode node, String name) { if (node == null) return null; JsonNode value = node.get(name); return value == null || value.isNull() || value.asText().isBlank() ? null : value.asText(); }
    private static String firstText(JsonNode node, String... names) { for (String name : names) { String value = text(node, name); if (value != null) return value; } return null; }
    private static String firstTextOr(String fallback, JsonNode node, String... names) { String value = firstText(node, names); return value == null ? fallback : value; }
    private static String safeMessage(Exception exception) { String value = exception.getMessage(); return truncate(value == null ? exception.getClass().getSimpleName() : value, 2000); }
    private record SourceLine(String lineId, String code, String name, String unit, BigDecimal quantity, BigDecimal total) {}
}
