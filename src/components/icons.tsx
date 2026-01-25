import type { SVGProps } from 'react';

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
      <path d="M12 18a2.5 2.5 0 0 0-2.5 2.5V22h5v-1.5A2.5 2.5 0 0 0 12 18Z" />
      <path d="M12 15a2.5 2.5 0 0 0 2.5-2.5V9l-5 3v.5A2.5 2.5 0 0 0 12 15Z" />
    </svg>
  );
}

export function GoogleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <title>Google</title>
      <path
        fill="currentColor"
        d="M12.48 10.92v3.28h7.84c-.24 1.84-.85 3.18-1.73 4.1-1.02 1.02-2.62 1.9-4.63 1.9-3.87 0-7-3.13-7-7s3.13-7 7-7c2.25 0 3.67.88 4.5 1.7l2.48-2.48C18.4 1.03 15.87 0 12.48 0 5.88 0 .04 5.88.04 12.5s5.84 12.5 12.44 12.5c3.34 0 5.76-1.12 7.63-2.98 1.9-1.87 2.5-4.4 2.5-6.82 0-.77-.07-1.52-.2-2.26H12.48z"
      />
    </svg>
  );
}
