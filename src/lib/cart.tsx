import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type CartItem = {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  quantity: number;
};

type Ctx = {
  items: CartItem[];
  add: (i: Omit<CartItem, "quantity">, qty?: number) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  subtotal: number;
  count: number;
};

const CartCtx = createContext<Ctx | null>(null);
const KEY = "gentry_cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
      if (raw) setItems(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(items));
  }, [items]);

  const add: Ctx["add"] = (i, qty = 1) => {
    setItems((prev) => {
      const found = prev.find((p) => p.id === i.id);
      if (found) return prev.map((p) => (p.id === i.id ? { ...p, quantity: p.quantity + qty } : p));
      return [...prev, { ...i, quantity: qty }];
    });
  };
  const remove = (id: string) => setItems((prev) => prev.filter((p) => p.id !== id));
  const setQty = (id: string, qty: number) =>
    setItems((prev) =>
      qty <= 0
        ? prev.filter((p) => p.id !== id)
        : prev.map((p) => (p.id === id ? { ...p, quantity: qty } : p)),
    );
  const clear = () => setItems([]);
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <CartCtx.Provider value={{ items, add, remove, setQty, clear, subtotal, count }}>
      {children}
    </CartCtx.Provider>
  );
}

export const useCart = () => {
  const v = useContext(CartCtx);
  if (!v) throw new Error("useCart outside provider");
  return v;
};
