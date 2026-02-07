'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Share2, Copy, Check, Info } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function ShareDialog({ isOpen, onOpenChange }: { isOpen: boolean; onOpenChange: (open: boolean) => void }) {
  const [url, setUrl] = useState('');
  const [copied, setCopying] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setUrl(window.location.origin);
    }
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopying(true);
    toast({ title: 'Link copied to clipboard' });
    setTimeout(() => setCopying(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'RentSafeUK',
          text: 'Manage your rental portfolio with RentSafeUK!',
          url: url,
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      handleCopy();
    }
  };

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Access on Mobile</DialogTitle>
          <DialogDescription>
            Scan the QR code or copy the link to open RentSafeUK on your phone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-6 py-4">
          <Alert variant="default" className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-900">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-xs text-blue-700 dark:text-blue-300">
              <strong>Workstation Users:</strong> Ensure you are logged into your Google account on your mobile browser to bypass the workstation proxy.
            </AlertDescription>
          </Alert>
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt="QR Code" className="w-48 h-48" />
          </div>
          <div className="flex w-full items-center space-x-2">
            <Input value={url} readOnly className="flex-1 text-xs" />
            <Button size="icon" variant="outline" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <DialogFooter className="sm:justify-start">
          <Button type="button" className="w-full" onClick={handleShare}>
            <Share2 className="mr-2 h-4 w-4" />
            Share Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
