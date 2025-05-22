import { SwitchTheme } from "~~/components/SwitchTheme";

/**
 * Site footer
 */
export const Footer = () => {
  return (
    <div className="flex items-center justify-between px-4 py-1 mt-auto border-t border-base-300">
      <div className="flex items-center justify-center gap-2 text-xs">
        <p className="">Built by</p>
        <a
          className="flex items-center justify-center gap-1 underline underline-offset-2"
          href="https://x.com/velkan_gst"
          target="_blank"
          rel="noreferrer"
        >
          velkan_gst
        </a>
        <p>using</p>
        <a
          className="flex items-center justify-center gap-1 underline underline-offset-2"
          href="https://scaffoldeth.io"
          target="_blank"
          rel="noreferrer"
        >
          Scaffold-ETH 2
        </a>
      </div>
      <SwitchTheme className={`pointer-events-auto`} />
    </div>
  );
};
