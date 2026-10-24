export function MapPreview() {
  return (
    <div className="relative w-full overflow-hidden rounded-[26px] border border-line bg-surface map-grid shadow-[0_30px_80px_-48px_rgba(17,17,19,0.45)]">
      <svg
        viewBox="0 0 520 400"
        role="img"
        aria-label="План помещения с маршрутом до стенда"
        className="block h-auto w-full"
      >
        {/* Комнаты */}
        <g fill="#ffffff" stroke="#e9e9ec" strokeWidth="1.5">
          <rect x="20" y="20" width="480" height="360" rx="18" />
          <rect x="20.75" y="20.75" width="169" height="155" rx="10" />
          <rect x="189.75" y="20.75" width="161.5" height="155" rx="10" />
          <rect x="351.25" y="20.75" width="148" height="155" rx="10" />
          <rect x="20.75" y="232.75" width="251" height="146.5" rx="10" />
          <rect x="271.75" y="232.75" width="227.5" height="146.5" rx="10" />
        </g>

        {/* Внутренние стены с проходами */}
        <g stroke="#e2e2e7" strokeWidth="2" strokeLinecap="round">
          <path d="M20 176H396M424 176H500" />
          <path d="M20 232H150M190 232H500" />
          <path d="M190 20V176M352 20V176M272 232V380" />
        </g>

        {/* Точки интереса */}
        <g fill="#d6d6dc" stroke="#ffffff" strokeWidth="2">
          <circle cx="105" cy="88" r="5" />
          <circle cx="282" cy="88" r="5" />
          <circle cx="430" cy="318" r="5" />
        </g>

        {/* Маршрут */}
        <path
          d="M78 344H170V204H410V120"
          fill="none"
          stroke="#e30613"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          className="route-line"
        />

        {/* Старт */}
        <g className="marker-pop" style={{ animationDelay: '0.35s' }}>
          <circle cx="78" cy="344" r="6.5" fill="#ffffff" stroke="#e30613" strokeWidth="3" />
        </g>

        {/* Финиш */}
        <g className="marker-pop" style={{ animationDelay: '1.5s' }}>
          <circle cx="410" cy="120" r="11" fill="#e30613" fillOpacity="0.12" />
          <circle cx="410" cy="120" r="6.5" fill="#e30613" stroke="#ffffff" strokeWidth="3" />
        </g>
      </svg>

      <span className="absolute right-4 top-4 rounded-full border border-line bg-white/90 px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em] text-muted backdrop-blur">
        360°
      </span>
    </div>
  )
}
