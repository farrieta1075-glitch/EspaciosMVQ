"use client";

import { FormEvent, useMemo, useState } from "react";
import { quinceEvent } from "@/lib/invitacion/event";

type Attendance = "si" | "no";

export function RsvpForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [attendance, setAttendance] = useState<Attendance>("si");
  const [guests, setGuests] = useState(1);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const whatsappHref = useMemo(() => {
    const lines = [
      `Hola, confirmo asistencia a los XV de ${quinceEvent.honoreeFirstName}.`,
      `Nombre: ${name.trim()}`,
      `Teléfono: ${phone.trim()}`,
      `Asistencia: ${attendance === "si" ? "Sí, asistiré" : "No podré asistir"}`,
    ];

    if (attendance === "si") {
      lines.push(`Personas: ${guests}`);
    }

    if (note.trim()) {
      lines.push(`Mensaje: ${note.trim()}`);
    }

    return `https://wa.me/${quinceEvent.rsvp.whatsapp}?text=${encodeURIComponent(lines.join("\n"))}`;
  }, [attendance, guests, name, note, phone]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (name.trim().length < 3) {
      setError("Escribe tu nombre completo.");
      return;
    }

    if (phone.trim().length < 8) {
      setError("Escribe un teléfono de contacto.");
      return;
    }

    setSubmitted(true);
    window.open(whatsappHref, "_blank", "noopener,noreferrer");
  }

  if (submitted) {
    return (
      <div className="invite-success">
        <p className="invite-script" style={{ fontSize: "2rem", color: "var(--invite-rose)", margin: 0 }}>
          ¡Gracias!
        </p>
        <p className="invite-serif" style={{ fontSize: "1.25rem", marginTop: "0.6rem" }}>
          {attendance === "si"
            ? "Recibimos tu confirmación. Si WhatsApp no se abrió, pulsa el botón para enviarla."
            : "Lamentamos que no puedas acompañarnos. Tu mensaje ya está listo para enviarse."}
        </p>
        <a className="invite-btn" href={whatsappHref} target="_blank" rel="noopener noreferrer" style={{ marginTop: "1.1rem" }}>
          Enviar por WhatsApp
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "1rem" }}>
      <div className="invite-field">
        <label htmlFor="rsvp-name">Nombre completo</label>
        <input
          id="rsvp-name"
          name="name"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Tu nombre"
          required
        />
      </div>

      <div className="invite-field">
        <label htmlFor="rsvp-phone">Teléfono</label>
        <input
          id="rsvp-phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="442 123 4567"
          required
        />
      </div>

      <div className="invite-field">
        <span>¿Nos acompañas?</span>
        <div className="invite-choice">
          <label>
            <input
              type="radio"
              name="attendance"
              value="si"
              checked={attendance === "si"}
              onChange={() => setAttendance("si")}
            />
            Sí, asistiré
          </label>
          <label>
            <input
              type="radio"
              name="attendance"
              value="no"
              checked={attendance === "no"}
              onChange={() => setAttendance("no")}
            />
            No podré ir
          </label>
        </div>
      </div>

      {attendance === "si" ? (
        <div className="invite-field">
          <label htmlFor="rsvp-guests">Número de personas (incluyéndote)</label>
          <input
            id="rsvp-guests"
            name="guests"
            type="number"
            min={1}
            max={10}
            value={guests}
            onChange={(event) => setGuests(Number(event.target.value) || 1)}
          />
        </div>
      ) : null}

      <div className="invite-field">
        <label htmlFor="rsvp-note">Mensaje (opcional)</label>
        <textarea
          id="rsvp-note"
          name="note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Una dedicatoria, alergias o alguna nota para la familia"
        />
      </div>

      {error ? (
        <p role="alert" style={{ color: "#9b3b46", margin: 0, fontSize: "0.92rem" }}>
          {error}
        </p>
      ) : null}

      <button className="invite-btn" type="submit">
        Confirmar asistencia
      </button>
    </form>
  );
}
