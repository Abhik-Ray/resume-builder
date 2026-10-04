import { ArrowLeft, Loader2 } from "lucide-react";
import { Link, Outlet, useLocation } from "react-router";
import { Suspense } from "react";

const SettingsLayout = () => {
  // Section pages get a link back to the tile grid
  const isSectionPage = useLocation().pathname.replace(/\/$/, "") !== "/settings";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4">
      {isSectionPage && (
        <Link
          to="/settings"
          className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> Settings
        </Link>
      )}
      <Suspense
        fallback={
          <div className="flex justify-center p-8">
            <Loader2 className="animate-spin" />
          </div>
        }
      >
        <Outlet />
      </Suspense>
    </div>
  );
};

export default SettingsLayout;
