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
