import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export type BusinessSettings = {
  business_name: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  hours: string;
  instagram: string;
  facebook: string;
  twitter: string;
  tiktok: string;
  youtube: string;
};

export type CommerceSettings = {
  currency: string;
  delivery_fee: number;
  pickup_address: string;
  low_stock_threshold: number;
};

export const defaultBusinessSettings: BusinessSettings = {
  business_name: "Deepcuts Hair Studio",
  email: "saviourchinyantac2@gmail.com",
  phone: "+260979011711",
  whatsapp: "+260979011711",
  address: "Chelstone Small Market, Lusaka, Zambia",
  hours: "Tue-Sat 9am-8pm · Sun 10am-4pm · Closed Mon",
  instagram: "https://instagram.com/DEEPCUTZM",
  facebook: "https://facebook.com/DEEPCUTSZM",
  twitter: "https://twitter.com",
  tiktok: "https://tiktok.com/@deepcutsbarbershop1",
  youtube: "https://youtube.com/@deepcutszm",
};

export const defaultCommerceSettings: CommerceSettings = {
  currency: "ZMW",
  delivery_fee: 15,
  pickup_address: "Chelstone Small Market, Lusaka, Zambia",
  low_stock_threshold: 5,
};

export const WEEKDAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
] as const;
export type Weekday = (typeof WEEKDAYS)[number]["key"];
export type DayHours = { open: string; close: string } | null;

export type BookingSettings = {
  slot_minutes: number;
  hours: Record<Weekday, DayHours>;
};

export type PaymentSettings = {
  mobile_money_number: string;
  mobile_money_name: string;
  bank_details: string;
};

export const defaultBookingSettings: BookingSettings = {
  slot_minutes: 60,
  hours: {
    mon: null,
    tue: { open: "09:00", close: "20:00" },
    wed: { open: "09:00", close: "20:00" },
    thu: { open: "09:00", close: "20:00" },
    fri: { open: "09:00", close: "20:00" },
    sat: { open: "09:00", close: "20:00" },
    sun: { open: "10:00", close: "16:00" },
  },
};

export const defaultPaymentSettings: PaymentSettings = {
  mobile_money_number: "",
  mobile_money_name: "",
  bank_details: "",
};

export function useSiteSettings() {
  const query = useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const values = await api.get<{
        business: Partial<BusinessSettings>;
        commerce: Partial<CommerceSettings>;
        booking?: Partial<BookingSettings>;
        payments?: Partial<PaymentSettings>;
      }>("/settings");
      return {
        business: { ...defaultBusinessSettings, ...values.business },
        commerce: { ...defaultCommerceSettings, ...values.commerce },
        booking: {
          slot_minutes: values.booking?.slot_minutes ?? defaultBookingSettings.slot_minutes,
          hours: { ...defaultBookingSettings.hours, ...(values.booking?.hours ?? {}) },
        },
        payments: { ...defaultPaymentSettings, ...values.payments },
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    ...query,
    business: query.data?.business ?? defaultBusinessSettings,
    commerce: query.data?.commerce ?? defaultCommerceSettings,
    booking: query.data?.booking ?? defaultBookingSettings,
    payments: query.data?.payments ?? defaultPaymentSettings,
  };
}
