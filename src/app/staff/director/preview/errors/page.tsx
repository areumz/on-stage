import { notFound } from "next/navigation";
import ErrorsShowcase from "./ErrorsShowcase";

// 시각 검증용 dev 전용 쇼케이스. 메인이 나중에 지운다.
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ErrorsShowcase />;
}
