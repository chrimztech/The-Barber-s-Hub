import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  email: "hello@deepcutshairstudio.com",
  phone: "+260 97 123 4567",
  whatsapp: "+260 97 123 4567",
  address: "Chelston, Lusaka, Zambia",
  hours: "Tue-Sat 9am-8pm · Sun 10am-4pm · Closed Mon",
  instagram: "https://instagram.com",
  facebook: "https://facebook.com",
  twitter: "https://twitter.com",
  tiktok: "https://tiktok.com",
  youtube: "https://youtube.com",
};

export const defaultCommerceSettings: CommerceSettings = {
  currency: "ZMW",
  delivery_fee: 15,
  pickup_address: "Chelston, Lusaka, Zambia",
  low_stock_threshold: 5,
};

export function useSiteSettings() {
  const query = useQuery({
    queryKey: ["site-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("settings")
        .select("key,value")
        .in("key", ["business", "commerce"]);
      if (error) throw error;
      const values = Object.fromEntries((data ?? []).map((item) => [item.key, item.value]));
      return {
        business: {
          ...defaultBusinessSettings,
          ...((values.business as Partial<BusinessSettings> | undefined) ?? {}),
        },
        commerce: {
          ...defaultCommerceSettings,
          ...((values.commerce as Partial<CommerceSettings> | undefined) ?? {}),
        },
      };
    },
  });

  return {
    ...query,
    business: query.data?.business ?? defaultBusinessSettings,
    commerce: query.data?.commerce ?? defaultCommerceSettings,
  };
}
