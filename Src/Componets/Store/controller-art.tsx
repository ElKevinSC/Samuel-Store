export function ControllerArt() {
  return <svg className="controller" viewBox="0 0 600 420" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="shell" x1="130" y1="70" x2="400" y2="380" gradientUnits="userSpaceOnUse"><stop stopColor="#454d5c"/><stop offset=".35" stopColor="#202630"/><stop offset="1" stopColor="#090e17"/></linearGradient>
      <linearGradient id="grip" x1="150" y1="130" x2="440" y2="380" gradientUnits="userSpaceOnUse"><stop stopColor="#222a37"/><stop offset="1" stopColor="#080c14"/></linearGradient>
      <linearGradient id="blue" x1="140" y1="80" x2="450" y2="280"><stop stopColor="#00a3ff"/><stop offset="1" stopColor="#0052bc"/></linearGradient>
      <filter id="shadow"><feDropShadow dx="0" dy="28" stdDeviation="20" floodColor="#000" floodOpacity=".7"/></filter>
    </defs>
    <g transform="rotate(-16 300 210)" filter="url(#shadow)">
      <path d="M155 107C176 79 217 84 244 91L354 91C386 81 425 87 443 114C468 153 499 281 483 317C470 346 444 348 423 326L366 271H236L180 328C158 350 130 343 117 317C101 280 129 148 155 107Z" fill="url(#shell)" stroke="#596378" strokeWidth="2"/>
      <path d="M160 125C138 165 117 278 131 312C140 331 153 332 167 318L229 253L210 132Z" fill="url(#grip)"/>
      <path d="M413 119C438 140 477 278 469 308C464 330 448 332 434 315L371 254L393 135Z" fill="url(#grip)"/>
      <path d="M214 108L248 115H350L383 107L370 184H229Z" fill="#111722" stroke="#4a5363"/>
      <path d="M215 104L246 112H350L383 104" stroke="url(#blue)" strokeWidth="5"/>
      <path d="M240 125H356L346 173H250Z" fill="#242b37" stroke="#333e4e"/>
      <circle cx="243" cy="227" r="40" fill="#0a101a" stroke="#3b4657" strokeWidth="3"/>
      <circle cx="243" cy="227" r="29" fill="#222b37" stroke="#4a586c" strokeWidth="3"/>
      <circle cx="355" cy="227" r="40" fill="#0a101a" stroke="#3b4657" strokeWidth="3"/>
      <circle cx="355" cy="227" r="29" fill="#222b37" stroke="#4a586c" strokeWidth="3"/>
      <path d="M173 143H189V160H207V177H189V195H173V177H155V160H173Z" fill="#0b1018" stroke="#596172" strokeWidth="2"/>
      <g fill="#101925" stroke="#43546b" strokeWidth="2"><circle cx="405" cy="139" r="13"/><circle cx="429" cy="163" r="13"/><circle cx="381" cy="163" r="13"/><circle cx="405" cy="188" r="13"/></g>
      <g stroke="#00a3ff" strokeWidth="2"><path d="M400 144L405 134L411 144Z"/><path d="M424 158L434 168M434 158L424 168"/><rect x="376" y="158" width="10" height="10"/><circle cx="405" cy="188" r="5"/></g>
      <circle cx="299" cy="204" r="9" fill="#008ff0"/><path d="M285 245H314" stroke="#3d4655" strokeWidth="3" strokeLinecap="round"/>
    </g>
  </svg>
}
