import { SafeAreaInsets } from "~~/types";

interface SafeAreaContainerProps {
  children: React.ReactNode;
  insets?: SafeAreaInsets;
}

export const SafeAreaContainer = ({ children, insets }: SafeAreaContainerProps) => (
  <main
    className="flex flex-col items-center justify-center min-h-screen gap-y-3"
    style={{
      marginTop: insets?.top ?? 0,
      marginBottom: insets?.bottom ?? 0,
      marginLeft: insets?.left ?? 0,
      marginRight: insets?.right ?? 0,
    }}
  >
    {children}
  </main>
);
