
export const initialClients = [
  {
    name: "João",
    purchases: [
      { desc: "Smartphone Samsung Galaxy", qty: 1, price: 1200.0, date: "2024-05-01" },
      { desc: "Fone Bluetooth JBL", qty: 2, price: 180.0, date: "2024-05-10" },
    ],
  },
  {
    name: "Maria",
    purchases: [
      { desc: "Notebook Dell Inspiron", qty: 1, price: 2500.0, date: "2024-05-12" },
    ],
  },
  {
    name: "Carlos",
    purchases: [
      { desc: "Tablet iPad Air", qty: 1, price: 1800.0, date: "2024-04-28" },
      { desc: "Carregador USB-C", qty: 3, price: 45.0, date: "2024-05-02" },
    ],
  },
];

export const initialStock = [
  { name: "Smartphone Samsung Galaxy", qty: 15, price: 1200.0, barcode: "7891234567890" },
  { name: "Notebook Dell Inspiron", qty: 8, price: 2500.0, barcode: "7891234567891" },
  { name: "Tablet iPad Air", qty: 12, price: 1800.0, barcode: "7891234567892" },
  { name: "Fone Bluetooth JBL", qty: 25, price: 180.0, barcode: "7891234567893" },
  { name: "Carregador USB-C", qty: 50, price: 45.0, barcode: "7891234567894" },
  { name: "Mouse Gamer Logitech", qty: 20, price: 120.0, barcode: "7891234567895" },
  { name: "Teclado Mecânico", qty: 18, price: 250.0, barcode: "7891234567896" },
  { name: "Monitor 24 Polegadas", qty: 10, price: 800.0, barcode: "7891234567897" },
];

export const initialSuppliers = [
  { id: 1, name: "Tech Distribuidora", contact: "(11) 99999-9999", email: "vendas@techdist.com" },
  { id: 2, name: "Eletrônicos Brasil", contact: "(21) 88888-8888", email: "comercial@eletronicosbrp.com" },
];
