
'use client'

import { useToast } from "@/components/ui/Toast";

export const toast = (message: string, type: 'success' | 'error' = 'success') => {
    const { toast } = useToast();
    toast(message, type);
};
