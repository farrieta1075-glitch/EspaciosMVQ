import Image from "next/image";
import { Calendar, Clock, ExternalLink, Gift, Heart, MapPin } from "lucide-react";
import { quinceEvent } from "@/lib/invitacion/event";
import { RsvpForm } from "@/components/invitacion/rsvp-form";

const navItems = [
  { href: "#inicio", label: "Inicio" },
  { href: "#palabras", label: "Palabras" },
  { href: "#lugar", label: "Lugar" },
  { href: "#regalos", label: "Mesa de regalos" },
  { href: "#confirmar", label: "Confirmar" },
];

export function InvitationPage() {
  return (
    <>
      <header className="invite-nav">
        <a href="#inicio" className="invite-script" style={{ fontSize: "1.6rem", color: "var(--invite-rose)" }}>
          {quinceEvent.honoreeFirstName}
        </a>
        <nav className="invite-nav-links" aria-label="Secciones de la invitación" style={{ display: "none" }}>
          {navItems.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        <a className="invite-btn" href="#confirmar" style={{ minHeight: "2.3rem", padding: "0.45rem 0.95rem" }}>
          Confirmar
        </a>
      </header>

      <main>
        <section id="inicio" className="invite-hero invite-section">
          <p className="invite-kicker invite-sans">{quinceEvent.parentsLine}</p>
          <h1 className="invite-title invite-script">{quinceEvent.headline}</h1>
          <p className="invite-serif" style={{ fontSize: "clamp(1.5rem, 4vw, 2.3rem)", margin: "0.2rem 0 1rem" }}>
            {quinceEvent.honoreeFullName}
          </p>
          <div className="invite-divider invite-serif">15</div>
          <p style={{ color: "var(--invite-muted)", marginBottom: "1.5rem" }}>
            {quinceEvent.datetime.dateLabel} · {quinceEvent.datetime.timeLabel}
          </p>
          <div style={{ display: "flex", gap: "0.7rem", justifyContent: "center", flexWrap: "wrap" }}>
            <a className="invite-btn" href="#confirmar">
              Confirmar asistencia
            </a>
            <a className="invite-btn invite-btn-outline" href={quinceEvent.venue.mapsUrl} target="_blank" rel="noopener noreferrer">
              Ver ubicación
            </a>
          </div>
          <figure className="invite-wrap" style={{ marginTop: "2.4rem" }}>
            <Image
              src="/invitacion/hero.png"
              alt="Diseños de la invitación de quinceañera"
              width={1600}
              height={900}
              priority
              style={{ width: "100%", height: "auto", borderRadius: "1.35rem", boxShadow: "0 18px 50px rgba(74, 59, 52, 0.12)" }}
            />
          </figure>
        </section>

        <section id="palabras" className="invite-section">
          <div className="invite-wrap invite-card" style={{ textAlign: "center" }}>
            <Heart aria-hidden="true" style={{ margin: "0 auto 0.6rem", color: "var(--invite-rose)" }} />
            <h2 className="invite-script" style={{ fontSize: "2.4rem", color: "var(--invite-rose)", margin: 0 }}>
              Unas palabras
            </h2>
            <div className="invite-divider" />
            <p className="invite-serif" style={{ fontSize: "1.28rem", lineHeight: 1.7, whiteSpace: "pre-line" }}>
              {quinceEvent.message}
            </p>
            <p style={{ marginTop: "1.4rem", color: "var(--invite-muted)" }}>
              {quinceEvent.parents}
            </p>
          </div>
        </section>

        <section id="lugar" className="invite-section">
          <div className="invite-wrap invite-card">
            <p className="invite-kicker">Cuándo y dónde</p>
            <h2 className="invite-script" style={{ fontSize: "2.4rem", color: "var(--invite-rose)", margin: "0.4rem 0 1.2rem" }}>
              El lugar de la celebración
            </h2>
            <div style={{ display: "grid", gap: "0.85rem", marginBottom: "1.3rem" }}>
              <p style={{ display: "flex", gap: "0.7rem", margin: 0 }}>
                <Calendar aria-hidden="true" size={18} />
                <span>
                  <strong>{quinceEvent.datetime.dateLabel}</strong>
                  <br />
                  {quinceEvent.datetime.receptionLabel}
                </span>
              </p>
              <p style={{ display: "flex", gap: "0.7rem", margin: 0 }}>
                <Clock aria-hidden="true" size={18} />
                <span>Ceremonia a las {quinceEvent.datetime.timeLabel}</span>
              </p>
              <p style={{ display: "flex", gap: "0.7rem", margin: 0 }}>
                <MapPin aria-hidden="true" size={18} />
                <span>
                  <strong>{quinceEvent.venue.name}</strong>
                  <br />
                  {quinceEvent.venue.address}
                  <br />
                  Código de vestimenta: {quinceEvent.dressCode}
                </span>
              </p>
            </div>
            <a
              className="invite-btn"
              href={quinceEvent.venue.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ marginBottom: "1.2rem" }}
            >
              Abrir en Google Maps
              <ExternalLink size={16} aria-hidden="true" />
            </a>
            <iframe
              className="invite-map"
              title={`Mapa de ${quinceEvent.venue.name}`}
              src={quinceEvent.venue.mapsEmbedUrl}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        </section>

        <section id="regalos" className="invite-section">
          <div className="invite-wrap">
            <div style={{ textAlign: "center", marginBottom: "1.3rem" }}>
              <Gift aria-hidden="true" style={{ margin: "0 auto 0.5rem", color: "var(--invite-rose)" }} />
              <h2 className="invite-script" style={{ fontSize: "2.4rem", color: "var(--invite-rose)", margin: 0 }}>
                Mesa de regalos
              </h2>
              <p style={{ color: "var(--invite-muted)", maxWidth: "38rem", margin: "0.8rem auto 0" }}>
                {quinceEvent.gifts.intro}
              </p>
            </div>
            <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              {quinceEvent.gifts.registries.map((registry) => (
                <article key={registry.store} className="invite-card">
                  <h3 className="invite-serif" style={{ fontSize: "1.55rem", margin: "0 0 0.5rem" }}>
                    {registry.store}
                  </h3>
                  {registry.eventNumber ? (
                    <p style={{ margin: "0 0 0.6rem" }}>
                      Evento: <strong>{registry.eventNumber}</strong>
                    </p>
                  ) : null}
                  <p style={{ color: "var(--invite-muted)", marginTop: 0 }}>{registry.note}</p>
                  <a
                    className="invite-btn invite-btn-outline"
                    href={registry.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ marginTop: "0.35rem" }}
                  >
                    Ir a {registry.store}
                    <ExternalLink size={16} aria-hidden="true" />
                  </a>
                </article>
              ))}
            </div>
            <p style={{ textAlign: "center", color: "var(--invite-muted)", marginTop: "1.2rem" }}>
              {quinceEvent.gifts.envelopeTable}
            </p>
          </div>
        </section>

        <section id="confirmar" className="invite-section" style={{ paddingBottom: "4.5rem" }}>
          <div className="invite-wrap invite-card">
            <h2 className="invite-script" style={{ fontSize: "2.4rem", color: "var(--invite-rose)", margin: 0, textAlign: "center" }}>
              Confirmar asistencia
            </h2>
            <p style={{ textAlign: "center", color: "var(--invite-muted)" }}>
              {quinceEvent.rsvp.deadlineLabel}
            </p>
            <RsvpForm />
          </div>
        </section>
      </main>
    </>
  );
}
