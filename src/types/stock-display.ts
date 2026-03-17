export interface StockProduct {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  minStock: number;
}

export interface StockWithProduct {
  id: string;
  quantity: number;
  status: 'normal' | 'low' | 'critical';
  product: StockProduct;
}

export interface StockLocation {
  id: string;
  name: string;
  description: string;
  type: string;
}

export interface SectorStockData {
  location: StockLocation;
  items: StockWithProduct[];
}
