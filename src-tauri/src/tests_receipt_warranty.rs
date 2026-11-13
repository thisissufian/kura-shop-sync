use crate::models::{BillItem, BillReceipt};
use crate::printer::escpos::format_receipt_bytes;
use crate::printer::pdf_gen::generate_receipt_pdf;

#[test]
fn test_escpos_and_pdf_warranty_and_client_labels() {
    let bill = BillReceipt {
        bill_no: "K1-261113-0099".to_string(),
        node_id: "K1".to_string(),
        hlc: "2026-11-13T12:00:00.000Z-0001-K1".to_string(),
        items: vec![BillItem {
            sku: "SKU-WAR".to_string(),
            name: "HOCO Rapid Charger 65W".to_string(),
            qty: 1,
            unit_price_minor: 1800,
            line_total_minor: 1800,
            warranty_label: "6 Months Warranty".to_string(),
        }],
        discount_minor: 0,
        total_minor: 1800,
        payment_mode: "WALLET".to_string(),
        customer_id: None,
        client_label: "Dr. Karim".to_string(),
        cashier_label: "Cashier · K2".to_string(),
        voided: false,
    };

    // 1. ESC/POS
    let bytes = format_receipt_bytes("Kura Store", "Dhaka", "$", "Thanks", &bill, 80);
    let s = String::from_utf8_lossy(&bytes);
    assert!(s.contains("Dr. Karim (WALLET)"));
    assert!(s.contains("Cashier · K2"));
    assert!(s.contains("Warr: 6 Months Warranty"));
    assert!(s.contains("Warranty claims require this invoice"));

    // 2. PDF
    let dir = std::env::temp_dir().join(format!("kura_test_pdf_{}", rand::random::<u32>()));
    let _ = std::fs::create_dir_all(&dir);
    let res = generate_receipt_pdf(&dir, "Kura Store", "Dhaka", "$", "Thanks", &bill).unwrap();
    let pdf_bytes = std::fs::read(&res.file_path).unwrap();
    let pdf_str = String::from_utf8_lossy(&pdf_bytes);
    assert!(pdf_str.contains("Dr. Karim"));
    assert!(pdf_str.contains("Cashier: Cashier"));
    assert!(pdf_str.contains("6 Months Warranty"));
    let _ = std::fs::remove_dir_all(&dir);
}
