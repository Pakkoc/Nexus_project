"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface UnsavedChangesContextType {
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (value: boolean) => void;
  confirmNavigation: (href: string) => void;
}

const UnsavedChangesContext = React.createContext<UnsavedChangesContextType | null>(null);

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  const [pendingHref, setPendingHref] = React.useState<string | null>(null);
  const [showDialog, setShowDialog] = React.useState(false);

  // 브라우저 새로고침/닫기 방지
  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const confirmNavigation = React.useCallback((href: string) => {
    if (hasUnsavedChanges) {
      setPendingHref(href);
      setShowDialog(true);
    } else {
      router.push(href);
    }
  }, [hasUnsavedChanges, router]);

  const handleConfirm = () => {
    setShowDialog(false);
    setHasUnsavedChanges(false);
    if (pendingHref) {
      router.push(pendingHref);
      setPendingHref(null);
    }
  };

  const handleCancel = () => {
    setShowDialog(false);
    setPendingHref(null);
  };

  return (
    <UnsavedChangesContext.Provider
      value={{ hasUnsavedChanges, setHasUnsavedChanges, confirmNavigation }}
    >
      {children}
      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>저장하지 않은 변경사항</AlertDialogTitle>
            <AlertDialogDescription>
              저장하지 않은 변경사항이 있습니다. 페이지를 떠나면 변경사항이 사라집니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>페이지 떠나기</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChanges() {
  const context = React.useContext(UnsavedChangesContext);
  if (!context) {
    throw new Error("useUnsavedChanges must be used within UnsavedChangesProvider");
  }
  return context;
}
