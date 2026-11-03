import hot from "@/assets/p-hot-coffee.jpg";
import cold from "@/assets/p-cold-coffee.jpg";
import tea from "@/assets/p-tea.jpg";
import juice from "@/assets/p-juice.jpg";
import savory from "@/assets/p-savory.jpg";
import dessert from "@/assets/p-dessert.jpg";

export const productImages: Record<string, string> = {
  "hot-coffee": hot,
  "cold-coffee": cold,
  tea,
  juice,
  savory,
  dessert,
};
export const imageFor = (key?: string) => (key ? (productImages[key] ?? key) : undefined);
