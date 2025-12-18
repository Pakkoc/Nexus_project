"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@iconify/react";

export function DashboardHeader() {
  const { data: session } = useSession();

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-700/50 bg-slate-900/50 px-6 backdrop-blur-sm">
      <Link href="/dashboard" className="text-xl font-bold text-white">
        Topia Empire
      </Link>

      <div className="flex items-center gap-4">
        {session?.user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 px-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={session.user.image ?? undefined} />
                  <AvatarFallback>
                    {session.user.name?.[0]?.toUpperCase() ?? "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-slate-300">{session.user.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem>
                <Icon icon="solar:user-linear" className="mr-2 h-4 w-4" />
                프로필
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Icon icon="solar:settings-linear" className="mr-2 h-4 w-4" />
                설정
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })}>
                <Icon icon="solar:logout-2-linear" className="mr-2 h-4 w-4" />
                로그아웃
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
