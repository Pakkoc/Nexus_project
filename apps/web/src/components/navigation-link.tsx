"use client";

import * as React from "react";
import Link from "next/link";
import { useUnsavedChanges } from "@/contexts/unsaved-changes-context";

interface NavigationLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: React.ReactNode;
}

export function NavigationLink({ href, children, onClick, ...props }: NavigationLinkProps) {
  const { hasUnsavedChanges, confirmNavigation } = useUnsavedChanges();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (hasUnsavedChanges) {
      e.preventDefault();
      confirmNavigation(href);
    }
    onClick?.(e);
  };

  return (
    <Link href={href} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}
