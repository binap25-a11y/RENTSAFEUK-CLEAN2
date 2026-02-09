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
import { Share2, Copy, Check, Info, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function ShareDialog({ isOpen, onOpenChange }: { isOpen: boolean; onOpenChange: (open: boolean) => void }) {
  const [url, setUrl] = useState('');
  const [copied, setCopying] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // We use the origin for the base PWA installation link
      setUrl(window.location.origin);
    }
  }, []);

  const handleCopy = () => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopying(true);
    toast({ title: 'Link copied to clipboard' });
    setTimeout(() => setCopying(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share && url) {
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

  const qrUrl = url ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}` : '';
  const isWorkstation = typeof window !== 'undefined' && window.location.hostname.includes('cloudworkstations.dev');

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
          {isWorkstation && (
            <Alert variant="default" className="bg-amber-50 border-yellow-200 dark:bg-amber-950 dark:border-amber-900">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertTitle className="text-xs font-bold text-amber-800 dark:text-amber-200">Workstation Access Hint</AlertTitle>
              <AlertDescription className="text-[11px] text-amber-700 dark:text-amber-300 leading-tight mt-1">
                Workstations are private. To scan and see the app, ensure your <strong>mobile browser</strong> is logged into the same Google account that owns this workstation.
              </AlertDescription>
            </Alert>
          )}
          
          <div className="bg-white p-4 rounded-xl shadow-sm border-2 border-muted flex items-center justify-center min-h-[232px] min-w-[232px]">
            {qrUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={qrUrl} alt="QR Code" className="w-48 h-48" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Share2 className="h-8 w-8 animate-pulse" />
                <span className="text-xs">Generating code...</span>
              </div>
            )}
          </div>

          <div className="flex w-full items-center space-x-2">
            <Input value={url} readOnly className="flex-1 text-xs bg-muted/50" />
            <Button size="icon" variant="outline" onClick={handleCopy} disabled={!url}>
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <DialogFooter className="sm:justify-start gap-2">
          <Button type="button" className="w-full" onClick={handleShare} disabled={!url}>
            <Share2 className="mr-2 h-4 w-4" />
            Share Link
          </Button>
          <Button type="button" variant="ghost" className="w-full sm:hidden" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
