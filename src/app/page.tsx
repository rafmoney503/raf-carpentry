import { readPageJson } from "@/lib/pages";
import HomeClient, { type HomePageData } from "./home-client";

export default function HomePage() {
  const data = readPageJson<HomePageData>("home.json");
  return <HomeClient data={data} />;
}
