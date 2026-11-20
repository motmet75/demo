package com.ams.bomcore.service.shop;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import invoice.*;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.w3c.dom.*;
import javax.imageio.ImageIO;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.*;
import java.net.URI;
import java.net.http.*;
import java.nio.file.*;
import java.time.Duration;
import java.util.*;
import java.util.zip.ZipInputStream;

@Service
public class ShopDocumentService {
    private static final int MAX_BYTES = 10 * 1024 * 1024;
    private final ObjectMapper json = new ObjectMapper();
    private final GoogleAuth auth = new GoogleAuth();
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();
    @Value("${invoice-desk.google-credentials:${GOOGLE_APPLICATION_CREDENTIALS:}}") private String credentials = "";
    @Value("${shop.documents.diachi-api-key:${DIACHI_API_KEY:}}") private String addressKey = "";

    public record BuyerResult(String buyerIdentityNumber, String buyerName, String buyerAddress,
                              String newAddress, List<String> warnings) {}

    public BuyerResult readBuyer(MultipartFile file) throws Exception {
        return readBuyer(List.of(file));
    }

    public BuyerResult readBuyer(List<MultipartFile> files) throws Exception {
        if (files == null || files.isEmpty() || files.size() > 4) throw new IllegalArgumentException("Chọn từ 1 đến 4 tệp của cùng một CCCD (mặt trước và mặt sau).");
        long totalBytes = 0;
        List<byte[]> images = new ArrayList<>();
        for (MultipartFile file : files) {
            String name = validate(file, "docx|pdf|png|jpe?g");
            totalBytes += file.getSize();
            if (totalBytes > MAX_BYTES) throw new IllegalArgumentException("Tổng dung lượng CCCD tối đa 10 MB.");
            images.addAll(cardImages(name, file.getBytes()));
            if (images.size() > 4) throw new IllegalArgumentException("CCCD chỉ nhận tối đa 4 ảnh/trang, tính cả mặt trước và mặt sau.");
        }
        var requests = new ArrayList<Map<String, Object>>();
        for (byte[] image : images) requests.add(Map.of("image", Map.of("content", Base64.getEncoder().encodeToString(image)),
                "features", List.of(Map.of("type", "DOCUMENT_TEXT_DETECTION")), "imageContext", Map.of("languageHints", List.of("vi", "en"))));
        Path credential = credential();
        var request = HttpRequest.newBuilder(URI.create("https://vision.googleapis.com/v1/images:annotate"))
                .timeout(Duration.ofSeconds(60)).header("Authorization", "Bearer " + auth.token(credential))
                .header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofByteArray(json.writeValueAsBytes(Map.of("requests", requests)))).build();
        var response = http.send(request, HttpResponse.BodyHandlers.ofByteArray());
        if (response.statusCode() != 200) throw new IOException("Google Vision không đọc được tài liệu (HTTP " + response.statusCode() + ").");
        JsonNode responses = json.readTree(response.body()).path("responses");
        if (!responses.isArray() || responses.size() != images.size()) throw new IOException("Google Vision trả về kết quả không đầy đủ.");
        var texts = new ArrayList<String>();
        for (JsonNode item : responses) {
            if (item.has("error")) throw new IOException("Google Vision không đọc được ảnh. Thử lại bằng ảnh CCCD rõ hơn.");
            texts.add(item.path("fullTextAnnotation").path("text").asText(""));
        }
        return combineBuyerTexts(texts);
    }

    static BuyerResult combineBuyerTexts(List<String> texts) {
        var identities = new LinkedHashSet<String>();
        var names = new LinkedHashSet<String>();
        var addresses = new LinkedHashSet<String>();
        for (String text : texts) {
            var buyer = CccdParser.parse(text);
            if (!buyer.buyerIdentityNumber().isBlank()) identities.add(buyer.buyerIdentityNumber());
            if (!buyer.buyerName().isBlank()) names.add(buyer.buyerName());
            if (!buyer.buyerAddress().isBlank()) addresses.add(buyer.buyerAddress());
        }
        if (identities.size() > 1 || names.size() > 1 || addresses.size() > 1)
            throw new IllegalArgumentException("Tài liệu có nhiều người hoặc thông tin mâu thuẫn. Mỗi lần chỉ đính kèm CCCD của một người.");
        if (names.isEmpty()) throw new IllegalArgumentException("Không đọc được họ tên. Đính kèm cả mặt trước và mặt sau CCCD rõ nét.");
        String identity = identities.stream().findFirst().orElse("");
        if (!identity.isBlank()) {
            for (String text : texts) {
                for (String line : text.lines().toList()) {
                    String compact = line.replaceAll("\\s+", "").toUpperCase(Locale.ROOT);
                    if (compact.startsWith("IDVNM") && !compact.contains(identity))
                        throw new IllegalArgumentException("Số CCCD ở mặt trước và dòng mã mặt sau không khớp. Kiểm tra hai ảnh thuộc cùng một người và rõ nét.");
                }
            }
        }
        var warnings = new ArrayList<String>();
        if (identity.isBlank()) warnings.add("Chưa đọc được số CCCD 12 chữ số; vui lòng nhập lại.");
        if (addresses.isEmpty()) warnings.add("Chưa đọc được nơi thường trú/cư trú; chọn cả mặt trước và mặt sau hoặc nhập lại địa chỉ.");
        return new BuyerResult(identity, names.iterator().next(), addresses.stream().findFirst().orElse(""), "", warnings);
    }

    public Map<String, Object> convertAddress(String address) throws Exception {
        if (address == null || address.isBlank() || address.length() > 500) throw new IllegalArgumentException("Địa chỉ phải có từ 1 đến 500 ký tự.");
        if (addressKey.isBlank()) return Map.of("converted", "", "notSure", true, "message", "Chưa cấu hình khóa diachi.io. Có thể tra cứu tại diachi.io và sửa địa chỉ bên dưới.");
        var request = HttpRequest.newBuilder(URI.create("https://diachi.io/api/convert-batch"))
                .timeout(Duration.ofSeconds(25)).header("Content-Type", "application/json").header("x-api-key", addressKey)
                .POST(HttpRequest.BodyPublishers.ofByteArray(json.writeValueAsBytes(Map.of("addresses", List.of(address))))).build();
        var response = http.send(request, HttpResponse.BodyHandlers.ofByteArray());
        if (response.statusCode() != 200) throw new IOException("diachi.io chưa chuyển đổi được địa chỉ (HTTP " + response.statusCode() + ").");
        var row = json.readTree(response.body()).path("data").path("results").path(0);
        if (!row.path("success").asBoolean() || row.path("converted").asText().isBlank()) throw new IOException("diachi.io không tìm thấy địa chỉ tương ứng.");
        return Map.of("converted", row.path("converted").asText(), "notSure", row.path("notSure").asBoolean(true));
    }

    public Invoice readInvoice(MultipartFile file) throws Exception {
        String name = validate(file, "xml|pdf|png|jpe?g");
        byte[] bytes = file.getBytes();
        if (name.endsWith(".xml")) return readXml(bytes);
        if (name.endsWith(".pdf")) {
            try (var pdf = Loader.loadPDF(bytes)) {
                if (pdf.getNumberOfPages() > 10) throw new IllegalArgumentException("Mỗi hóa đơn tối đa 10 trang.");
                for (var page : pdf.getPages()) if (page.getMediaBox().getWidth() > 1500 || page.getMediaBox().getHeight() > 1500)
                    throw new IllegalArgumentException("Kích thước trang PDF quá lớn.");
            }
        } else validateImage(bytes);
        Path workspace = Files.createTempDirectory("shop-invoice-");
        try {
            var settings = new Settings(workspace);
            boolean google = !credentials.isBlank();
            settings.p.setProperty("ocr", google ? "google" : "off");
            if (google) {
                settings.p.setProperty("google.credentials", credential().toString());
                settings.p.setProperty("server.google.enabled", "true");
            }
            Path source = workspace.resolve("invoice" + name.substring(name.lastIndexOf('.')));
            Files.write(source, bytes);
            Invoice invoice = new Engine(settings).read(source);
            invoice.source = file.getOriginalFilename();
            invoice.text = "";
            if (invoice.items.isEmpty()) throw new IllegalArgumentException("Không đọc được dòng hàng. Thử tệp XML hóa đơn hoặc ảnh/PDF rõ hơn.");
            return invoice;
        } finally {
            try (var paths = Files.walk(workspace)) {
                for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) Files.deleteIfExists(path);
            }
        }
    }

    static Invoice readXml(byte[] bytes) throws Exception {
        var factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
        factory.setXIncludeAware(false); factory.setExpandEntityReferences(false);
        var document = factory.newDocumentBuilder().parse(new ByteArrayInputStream(bytes));
        var invoice = new Invoice(); invoice.method = "Invoice XML";
        var buyer = document.getElementsByTagNameNS("*", "NMua");
        if (buyer.getLength() > 0) {
            Element element = (Element) buyer.item(0);
            invoice.put("buyer", tag(element, "Ten")); invoice.put("buyerTaxId", tag(element, "MST"));
            invoice.put("buyerAddress", tag(element, "DChi")); invoice.put("buyerName", tag(element, "HVTNMHang"));
        }
        invoice.put("number", tag(document.getDocumentElement(), "SHDon"));
        invoice.put("taxRate", tag(document.getDocumentElement(), "TSuat"));
        var rows = document.getElementsByTagNameNS("*", "HHDVu");
        if (rows.getLength() == 0 || rows.getLength() > 200) throw new IllegalArgumentException("XML phải chứa 1–200 dòng HHDVu.");
        for (int i = 0; i < rows.getLength(); i++) {
            var element = (Element) rows.item(i);
            invoice.items.add(new LinkedHashMap<>(Map.of("line", String.valueOf(i + 1), "description", tag(element, "THHDVu"),
                    "code", tag(element, "MHHDVu"), "quantity", tag(element, "SLuong"), "unit", tag(element, "DVTinh"),
                    "unitPrice", tag(element, "DGia"), "amount", tag(element, "ThTien"))));
        }
        invoice.warnings.add("Kiểm tra đơn giá bán và VAT, đơn vị tính và hàng kho trước khi tạo đơn.");
        return invoice;
    }
    private static String tag(Element element, String name) {
        var nodes = element.getElementsByTagNameNS("*", name);
        return nodes.getLength() == 0 ? "" : nodes.item(0).getTextContent().trim();
    }
    private Path credential() {
        if (credentials.isBlank() || !Files.isReadable(Path.of(credentials))) throw new IllegalStateException("Chưa cấu hình Google Vision cho máy chủ (invoice-desk.google-credentials).");
        return Path.of(credentials);
    }
    private static String validate(MultipartFile file, String extensions) {
        String name = Objects.toString(file.getOriginalFilename(), "").toLowerCase(Locale.ROOT);
        if (file.isEmpty() || file.getSize() > MAX_BYTES || !name.matches(".*\\.(" + extensions + ")")) throw new IllegalArgumentException("Tệp không đúng định dạng hoặc lớn hơn 10 MB.");
        return name;
    }
    static List<byte[]> cardImages(String name, byte[] bytes) throws Exception {
        var images = new ArrayList<byte[]>();
        if (name.endsWith(".docx")) {
            long expanded = 0; int entries = 0;
            try (var zip = new ZipInputStream(new ByteArrayInputStream(bytes))) {
                for (var entry = zip.getNextEntry(); entry != null; entry = zip.getNextEntry()) {
                    if (++entries > 200) throw new IllegalArgumentException("DOCX có quá nhiều thành phần.");
                    byte[] content = zip.readNBytes(MAX_BYTES + 1); expanded += content.length;
                    if (content.length > MAX_BYTES || expanded > 40L * 1024 * 1024) throw new IllegalArgumentException("DOCX giải nén quá lớn.");
                    if (entry.getName().matches("word/media/[^/]+\\.(?i:png|jpe?g)")) {
                        validateImage(content); images.add(content);
                        if (images.size() > 4) throw new IllegalArgumentException("CCCD chỉ nhận tối đa 4 ảnh.");
                    }
                }
            }
        } else if (name.endsWith(".pdf")) {
            try (var pdf = Loader.loadPDF(bytes)) {
                if (pdf.getNumberOfPages() > 4) throw new IllegalArgumentException("CCCD chỉ nhận tối đa 4 trang.");
                var renderer = new PDFRenderer(pdf);
                for (int i = 0; i < pdf.getNumberOfPages(); i++) {
                    var box = pdf.getPage(i).getCropBox();
                    if (box.getWidth() > 1200 || box.getHeight() > 1200) throw new IllegalArgumentException("Kích thước trang PDF quá lớn.");
                    var out = new ByteArrayOutputStream(); ImageIO.write(renderer.renderImageWithDPI(i, 180), "png", out); images.add(out.toByteArray());
                }
            }
        } else { validateImage(bytes); images.add(bytes); }
        if (images.isEmpty()) throw new IllegalArgumentException("Không tìm thấy ảnh CCCD trong tài liệu.");
        return images;
    }
    private static void validateImage(byte[] bytes) throws IOException {
        try (var stream = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
            var readers = ImageIO.getImageReaders(stream);
            if (!readers.hasNext()) throw new IllegalArgumentException("Ảnh không hợp lệ.");
            var reader = readers.next();
            try {
                reader.setInput(stream);
                if ((long) reader.getWidth(0) * reader.getHeight(0) > 20_000_000) throw new IllegalArgumentException("Ảnh vượt quá 20 megapixel.");
            } finally { reader.dispose(); }
        }
    }
}
