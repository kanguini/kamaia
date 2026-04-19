/**
 * Kamaia wordmark — same viewBox as the web app so any exported asset
 * matches. Uses currentColor so parent text colour wins.
 */
interface LogoProps {
  className?: string
  /** Height in pixels. Width auto-scales to 225.83:35.81 ratio. */
  height?: number
}

export function Logo({ className, height = 32 }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 225.83 35.81"
      height={height}
      aria-label="Kamaia"
      role="img"
      className={className}
      fill="currentColor"
    >
      <g>
        <polygon points="42.27 35.81 32.47 35.81 22.03 18.77 16.94 27.08 8.36 27.08 8.36 35.81 0 35.81 0 0 8.36 0 8.36 25.07 23.72 0 33.52 0 22.83 17.47 31.03 17.47 42.27 35.81" />
        <path d="M71.02,0h-11.45l-12.26,35.81h8.52l2.16-7.05h14.61l2.17,7.05h8.47L71.02,0ZM59.63,23.39l5.26-17.2h.76l5.29,17.2h-11.31Z" />
        <path d="M88.17,35.81V0h11.72l9.98,26.97h.27L119.97,0h11.18v35.81h-7.32l.43-27.89h-.54l-10.85,27.89h-6.62l-10.69-27.89h-.54l.43,27.89h-7.27Z" />
        <path d="M159.85,0h-11.45l-12.26,35.81h8.52l2.16-7.05h14.61l2.17,7.05h8.47L159.85,0ZM148.46,23.39l5.26-17.2h.76l5.29,17.2h-11.31Z" />
        <path d="M177,35.81V0h7.92v35.81h-7.92Z" />
        <path d="M213.62,0h-11.45l-12.26,35.81h8.52l2.16-7.05h14.61l2.17,7.05h8.46L213.62,0ZM202.23,23.39l5.26-17.2h.76l5.29,17.2h-11.31Z" />
      </g>
    </svg>
  )
}
