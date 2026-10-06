/**
 * Personaliza aquí los datos de la quinceañera.
 * La página /invitacion toma todo de este archivo.
 */
export const quinceEvent = {
  honoreeFirstName: "Valeria",
  honoreeFullName: "Valeria Torres Hernández",
  headline: "Mis Quince Años",
  parentsLine: "Con la bendición de Dios y el amor de mis padres",
  parents: "Laura Hernández y Miguel Ángel Torres",
  message: `Hoy el tiempo se detiene un instante para celebrar la niña que fui y la mujer que empiezo a ser.

Quiero que estés conmigo en esta noche de flores, música y gratitud. Tu compañía convierte este sueño en un recuerdo que voy a guardar para siempre.

Con todo mi cariño, te espero.`,
  datetime: {
    dateLabel: "Sábado 14 de noviembre de 2026",
    timeLabel: "18:00 horas",
    receptionLabel: "Recepción a las 20:00 horas",
    iso: "2026-11-14T18:00:00-06:00",
  },
  venue: {
    name: "Jardín Aurora",
    address: "Av. Constituyentes 102, Col. Centro, Santiago de Querétaro, Qro.",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Av.+Constituyentes+102,+Santiago+de+Quer%C3%A9taro,+Qro.",
    mapsEmbedUrl:
      "https://maps.google.com/maps?q=Av.+Constituyentes+102,+Santiago+de+Quer%C3%A9taro,+Qro.&z=16&hl=es&output=embed",
  },
  dressCode: "Etiqueta formal",
  gifts: {
    intro:
      "Tu presencia es el regalo más valioso. Si deseas tener un detalle, puedes hacerlo a través de estas mesas de regalos:",
    registries: [
      {
        store: "Liverpool",
        eventNumber: "50384721",
        url: "https://www.liverpool.com.mx/tienda/mesa-de-regalos",
        note: "Busca el evento con el número o el nombre de la festejada.",
      },
      {
        store: "Amazon",
        eventNumber: null,
        url: "https://www.amazon.com.mx/registries",
        note: "Lista de deseos para quienes prefieren enviar un detalle a casa.",
      },
    ],
    envelopeTable: "El día del evento también habrá una mesa de sobres.",
  },
  rsvp: {
    /** Número internacional, sin signos: 52 + 10 dígitos. */
    whatsapp: "524421234567",
    deadlineLabel: "Confirma, por favor, antes del 1 de noviembre",
  },
} as const;

export type QuinceEvent = typeof quinceEvent;
