import { Metadata } from "next";
import App from "~~/components/pages/app";
import { APP_URL } from "~~/lib/constants";

const frame = {
  version: "next",
  imageUrl: `${APP_URL}/images/feed.png`,
  button: {
    title: "Launch Game",
    action: {
      type: "launch_frame",
      name: "Monad Match",
      url: APP_URL,
      splashImageUrl: `${APP_URL}/images/splash.png`,
      splashBackgroundColor: "#f7f7f7",
    },
  },
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Monad Match",
    openGraph: {
      title: "Monad Match",
      description: "A Match-3 game on Monad",
    },
    other: {
      "fc:frame": JSON.stringify(frame),
    },
  };
}

export default function Home() {
  return <App />;
}
