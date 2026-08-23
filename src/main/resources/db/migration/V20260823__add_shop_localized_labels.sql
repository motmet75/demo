CREATE TABLE IF NOT EXISTS shop_localized_label (
    id              UUID PRIMARY KEY,
    tenant_id       UUID,
    company_id      UUID,
    label_namespace VARCHAR(60)  NOT NULL,
    label_key       VARCHAR(120) NOT NULL,
    default_text    TEXT         NOT NULL,
    translations    TEXT,
    display_order   INTEGER      NOT NULL DEFAULT 0,
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_shop_localized_label_scope_key
    ON shop_localized_label (
        COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid),
        label_namespace,
        label_key
    );

CREATE INDEX IF NOT EXISTS idx_shop_localized_label_scope
    ON shop_localized_label(tenant_id, company_id, label_namespace);

WITH labels(label_namespace, label_key, default_text, display_order, translations) AS (
    VALUES
    ('shop_order_status', 'PENDING', 'Placed', 10, jsonb_build_object(
        'en','Placed','vi','Vừa đặt món','cn','已下单','tw','已下單','ja','受付済み','ko','접수됨','es','Realizado','dv','އޯޑަރ ލިބިއްޖެ','ms','Dipesan','id','Dipesan','th','รับออเดอร์แล้ว')::text),
    ('shop_order_status', 'CONFIRMED', 'Confirmed', 20, jsonb_build_object(
        'en','Confirmed','vi','Đã xác nhận','cn','已确认','tw','已確認','ja','確認済み','ko','확인됨','es','Confirmado','dv','ޔަޤީންކުރެވިފައި','ms','Disahkan','id','Dikonfirmasi','th','ยืนยันแล้ว')::text),
    ('shop_order_status', 'PREPARING', 'Preparing', 30, jsonb_build_object(
        'en','Preparing','vi','Đang chuẩn bị','cn','制作中','tw','準備中','ja','準備中','ko','준비 중','es','Preparando','dv','ތައްޔާރުވަނީ','ms','Sedang disediakan','id','Sedang disiapkan','th','กำลังเตรียม')::text),
    ('shop_order_status', 'READY', 'Ready', 40, jsonb_build_object(
        'en','Ready','vi','Sẵn sàng','cn','已准备好','tw','已備妥','ja','準備完了','ko','준비 완료','es','Listo','dv','ތައްޔާރު','ms','Sedia','id','Siap','th','พร้อมรับ')::text),
    ('shop_order_status', 'PICKED_UP', 'Picked Up', 50, jsonb_build_object(
        'en','Picked Up','vi','Đã nhận','cn','已取餐','tw','已取餐','ja','受け取り済み','ko','수령 완료','es','Recogido','dv','ނަގާފައި','ms','Diambil','id','Diambil','th','รับแล้ว')::text),
    ('shop_order_status', 'COMPLETED', 'Completed', 60, jsonb_build_object(
        'en','Completed','vi','Hoàn tất','cn','已完成','tw','已完成','ja','完了','ko','완료','es','Completado','dv','ނިމިފައި','ms','Selesai','id','Selesai','th','เสร็จสิ้น')::text),
    ('shop_order_status', 'CANCELLED', 'Cancelled', 70, jsonb_build_object(
        'en','Cancelled','vi','Đã hủy','cn','已取消','tw','已取消','ja','キャンセル済み','ko','취소됨','es','Cancelado','dv','ކެންސަލްކުރެވިފައި','ms','Dibatalkan','id','Dibatalkan','th','ยกเลิกแล้ว')::text),

    ('shop_payment_status', 'UNPAID', 'Unpaid', 10, jsonb_build_object(
        'en','Unpaid','vi','Chưa thanh toán','cn','未付款','tw','未付款','ja','未払い','ko','미결제','es','Pendiente','dv','ދައްކާނުލާ','ms','Belum dibayar','id','Belum dibayar','th','ยังไม่ชำระ')::text),
    ('shop_payment_status', 'PAID', 'Paid', 20, jsonb_build_object(
        'en','Paid','vi','Đã thanh toán','cn','已付款','tw','已付款','ja','支払い済み','ko','결제됨','es','Pagado','dv','ދައްކާފައި','ms','Dibayar','id','Dibayar','th','ชำระแล้ว')::text),

    ('shop_payment_method', 'CASH', 'Cash', 10, jsonb_build_object(
        'en','Cash','vi','Tiền mặt','cn','现金','tw','現金','ja','現金','ko','현금','es','Efectivo','dv','ކޭޝް','ms','Tunai','id','Tunai','th','เงินสด')::text),
    ('shop_payment_method', 'BANK_QR', 'Bank QR', 20, jsonb_build_object(
        'en','Bank QR','vi','Chuyển khoản QR','cn','银行二维码','tw','銀行 QR','ja','銀行QR','ko','은행 QR','es','QR bancario','dv','ބޭންކް QR','ms','QR bank','id','QR bank','th','QR ธนาคาร')::text),
    ('shop_payment_method', 'SPLIT', 'Split Payment', 30, jsonb_build_object(
        'en','Split Payment','vi','Thanh toán tách','cn','拆分付款','tw','分開付款','ja','分割支払い','ko','분할 결제','es','Pago dividido','dv','ބައިކޮށް ދައްކާނީ','ms','Bayaran berasingan','id','Pembayaran terpisah','th','แบ่งชำระ')::text),

    ('shop_fulfillment_type', 'DINE_IN', 'Dine In', 10, jsonb_build_object(
        'en','Dine In','vi','Ăn tại chỗ','cn','堂食','tw','內用','ja','店内','ko','매장 식사','es','Comer aqui','dv','ތަނުގައި ކާން','ms','Makan di sini','id','Makan di tempat','th','ทานที่ร้าน')::text),
    ('shop_fulfillment_type', 'PICKUP', 'Pickup', 20, jsonb_build_object(
        'en','Pickup','vi','Mang đi','cn','自取','tw','自取','ja','持ち帰り','ko','픽업','es','Recoger','dv','ޕިކްއަޕް','ms','Ambil sendiri','id','Ambil sendiri','th','รับกลับ')::text),
    ('shop_fulfillment_type', 'DELIVERY', 'Delivery', 30, jsonb_build_object(
        'en','Delivery','vi','Giao hàng','cn','配送','tw','外送','ja','配達','ko','배달','es','Entrega','dv','ޑެލިވަރީ','ms','Penghantaran','id','Pengiriman','th','จัดส่ง')::text),

    ('shop_action', 'VIEW_ORDER', 'View Order', 10, jsonb_build_object(
        'en','View Order','vi','Xem đơn','cn','查看订单','tw','查看訂單','ja','注文を見る','ko','주문 보기','es','Ver pedido','ms','Lihat pesanan','id','Lihat pesanan','th','ดูออเดอร์')::text),
    ('shop_action', 'EDIT_ORDER', 'Edit Order', 20, jsonb_build_object(
        'en','Edit Order','vi','Sửa đơn hàng','cn','编辑订单','tw','編輯訂單','ja','注文を編集','ko','주문 수정','es','Editar pedido','ms','Edit pesanan','id','Edit pesanan','th','แก้ไขออเดอร์')::text),
    ('shop_action', 'PAY', 'Pay', 30, jsonb_build_object(
        'en','Pay','vi','Thanh toán','cn','付款','tw','付款','ja','支払う','ko','결제','es','Pagar','ms','Bayar','id','Bayar','th','ชำระเงิน')::text)
)
INSERT INTO shop_localized_label (
    id, tenant_id, company_id, label_namespace, label_key, default_text, display_order, translations
)
SELECT md5('shop-localized-label:global:' || label_namespace || ':' || label_key)::uuid,
       NULL, NULL, label_namespace, label_key, default_text, display_order, translations
FROM labels
WHERE NOT EXISTS (
    SELECT 1
    FROM shop_localized_label existing
    WHERE existing.tenant_id IS NULL
      AND existing.company_id IS NULL
      AND existing.label_namespace = labels.label_namespace
      AND existing.label_key = labels.label_key
);
