"use client"

import * as React from "react"
import Link from "next/link"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { MapIcon, UsersIcon, RadioIcon } from "lucide-react"

export function AppSidebar({
  user,
  logoutAction,
  ...props
}: {
  user: { name: string; administrator: boolean }
  logoutAction: () => Promise<void>
} & React.ComponentProps<typeof Sidebar>) {
  const navMain = [
    { title: "Map", url: "/map", icon: <MapIcon /> },
    ...(user.administrator
      ? [
          { title: "Users", url: "/admin/users", icon: <UsersIcon /> },
          { title: "Devices", url: "/admin/devices", icon: <RadioIcon /> },
        ]
      : []),
  ]

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href="/map" />}
            >
              <span className="text-base font-semibold">Asaka</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} logoutAction={logoutAction} />
      </SidebarFooter>
    </Sidebar>
  )
}
