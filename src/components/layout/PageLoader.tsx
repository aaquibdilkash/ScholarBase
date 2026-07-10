"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import NProgress from "nprogress";
import "nprogress/nprogress.css";

export function PageLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    NProgress.configure({ showSpinner: false });

    const handleStart = () => NProgress.start();
    const handleStop = () => NProgress.done();

    handleStop(); // Stop progress on initial load

    return () => {
      handleStop();
    };
  }, []);

  useEffect(() => {
    NProgress.done();
  }, [pathname, searchParams]);

  // This is a component that wraps page navigation logic,
  // we can use a component that hijacks link clicks
  // but this is a simpler approach for now.
  // We will just show the loader on every navigation change.

  useEffect(() => {
    // We are not using the router events because they are not
    // reliable with the app router.
    // Instead we will just start the progress and end it when the new page loads.
    NProgress.start();
  }, [pathname]);

  return null;
}
