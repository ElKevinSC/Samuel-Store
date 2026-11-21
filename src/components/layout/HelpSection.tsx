import { FAQ_ITEMS, HOW_TO } from '@/data/help'

export function HelpSection() {
  return (
    <section className="section wrap" id="ayuda">
      <div className="section-heading"><div><h2>Cómo comprar<span className="blue-text">.</span></h2></div></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {HOW_TO.map(([title, text], i) => (
          <div key={title} style={{ background: '#0b1320', border: '1px solid #1b2a3a', borderRadius: 12, padding: 16 }}>
            <strong style={{ color: '#00a3ff' }}>Paso {i + 1}</strong>
            <h3>{title}</h3>
            <p style={{ fontSize: 14, opacity: 0.85 }}>{text}</p>
          </div>
        ))}
      </div>
      <h3 style={{ marginTop: 24 }}>Preguntas frecuentes</h3>
      {FAQ_ITEMS.map(([q, a]) => (
        <details key={q} style={{ background: '#0b1320', border: '1px solid #1b2a3a', borderRadius: 12, padding: '12px 16px', margin: '8px 0' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{q}</summary>
          <p style={{ marginTop: 8, fontSize: 14, opacity: 0.85 }}>{a}</p>
        </details>
      ))}
    </section>
  )
}
