import "./style.css";

export const metadata = {
  title: "Smile MakeOver | Affordable Veneers & Cosmetic Dentistry",
  description:
    "Get a brand new smile for less than you think. Premium cosmetic dentistry with affordable financing options.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
