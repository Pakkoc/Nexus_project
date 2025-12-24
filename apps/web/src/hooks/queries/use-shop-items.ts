import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ShopItem, CreateShopItem, UpdateShopItem } from "@/types/shop";

// Fetch shop items
export function useShopItems(guildId: string) {
  return useQuery<ShopItem[]>({
    queryKey: ["shop-items", guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/shop/items`);
      if (!res.ok) throw new Error("Failed to fetch shop items");
      return res.json();
    },
  });
}

// Create shop item
export function useCreateShopItem(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation<ShopItem, Error, CreateShopItem>({
    mutationFn: async (data) => {
      const res = await fetch(`/api/guilds/${guildId}/shop/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create shop item");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shop-items", guildId] });
    },
  });
}

// Update shop item
export function useUpdateShopItem(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation<ShopItem, Error, { id: number; data: UpdateShopItem }>({
    mutationFn: async ({ id, data }) => {
      const res = await fetch(`/api/guilds/${guildId}/shop/items/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update shop item");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shop-items", guildId] });
    },
  });
}

// Delete shop item
export function useDeleteShopItem(guildId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, number>({
    mutationFn: async (id) => {
      const res = await fetch(`/api/guilds/${guildId}/shop/items/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete shop item");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shop-items", guildId] });
    },
  });
}

// ========== Color Options ==========

export interface ColorOption {
  id: number;
  itemId: number;
  color: string;
  name: string;
  roleId: string;
  price: number;
  createdAt: string;
}

export interface CreateColorOption {
  color: string;
  name: string;
  roleId: string;
  price: number;
}

// Fetch color options
export function useColorOptions(guildId: string, itemId: number | null) {
  return useQuery<ColorOption[]>({
    queryKey: ["color-options", guildId, itemId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/shop/items/${itemId}/colors`);
      if (!res.ok) throw new Error("Failed to fetch color options");
      return res.json();
    },
    enabled: !!itemId,
  });
}

// Create color option
export function useCreateColorOption(guildId: string, itemId: number) {
  const queryClient = useQueryClient();

  return useMutation<ColorOption, Error, CreateColorOption>({
    mutationFn: async (data) => {
      const res = await fetch(`/api/guilds/${guildId}/shop/items/${itemId}/colors`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create color option");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["color-options", guildId, itemId] });
    },
  });
}

// Delete color option
export function useDeleteColorOption(guildId: string, itemId: number) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, number>({
    mutationFn: async (colorId) => {
      const res = await fetch(`/api/guilds/${guildId}/shop/items/${itemId}/colors/${colorId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete color option");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["color-options", guildId, itemId] });
    },
  });
}
