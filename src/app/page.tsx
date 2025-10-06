"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { Bot, User } from "lucide-react";
import Modal from "./api/components/modalRFC";

type Mensaje = {
  remitente: "user" | "bot";
  texto: string;
};

export default function Home() {
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    {
      remitente: "bot",
      texto:
        "👋 Hola, soy tu asistente contable con IA. Selecciona tu RFC, activa el modo detallado si quieres elegir fechas, y pregúntame sobre tus facturas.",
    },
  ]);
  const [entrada, setEntrada] = useState("");
  const [selectedRFC, setSelectedRFC] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [modoDetallado, setModoDetallado] = useState(false);
  const [cargando, setCargando] = useState(false); // 👈 nuevo estado

  const manejarEnvio = async () => {
    if (!entrada.trim()) return;

    if (modoDetallado) {
      if (!fechaInicio || !fechaFin) {
        alert("⚠️ Debes seleccionar un rango de fechas.");
        return;
      }

      const diff =
        (new Date(fechaFin).getTime() - new Date(fechaInicio).getTime()) /
        (1000 * 60 * 60 * 24);

      if (diff < 0) {
        alert("⚠️ La fecha fin no puede ser menor que la fecha inicio.");
        return;
      }
      if (diff > 31) {
        alert("⚠️ El rango no puede ser mayor a 1 mes.");
        return;
      }
    }

    const nuevoMensaje: Mensaje = { remitente: "user", texto: entrada };
    setMensajes((prev) => [...prev, nuevoMensaje]);
    setEntrada("");
    setCargando(true); // 👈 activa animación "escribiendo"

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: entrada,
          rfc: selectedRFC,
          fechaInicio: modoDetallado ? fechaInicio : null,
          fechaFin: modoDetallado ? fechaFin : null,
        }),
      });

      const data = await res.json();

      setMensajes((prev) => [
        ...prev,
        { remitente: "bot", texto: data.reply },
      ]);
    } catch (err) {
      setMensajes((prev) => [
        ...prev,
        {
          remitente: "bot",
          texto: "⚠️ Hubo un error al conectar con el asistente.",
        },
      ]);
    } finally {
      setCargando(false); // 👈 desactiva animación
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white p-6">
      <div className="w-full max-w-3xl bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-6">
        <h1 className="text-3xl font-bold text-center mb-6 bg-gradient-to-r from-blue-400 to-cyan-300 text-transparent bg-clip-text">
          🤖 AICuenta
        </h1>

        {/* Botones RFC y modo */}
        <div className="mb-4 flex justify-center gap-4">
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl shadow"
          >
            Seleccionar RFC
          </button>

          <button
            onClick={() => setModoDetallado((prev) => !prev)}
            className={`px-4 py-2 rounded-xl shadow ${
              modoDetallado
                ? "bg-cyan-500 text-white"
                : "bg-gray-600 text-gray-300"
            }`}
            disabled={!selectedRFC}
          >
            {modoDetallado ? "Modo detallado: ON" : "Modo detallado: OFF"}
          </button>
        </div>

        {selectedRFC && (
          <p className="text-center text-sm text-gray-300 mb-4">
            RFC seleccionado: <span className="font-bold">{selectedRFC}</span>
          </p>
        )}

        {modoDetallado && (
          <div className="flex gap-4 mb-4 justify-center">
            <input
              type="date"
              className="px-3 py-2 rounded-lg bg-black/40 border border-white/20 text-white"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              disabled={!selectedRFC}
            />
            <input
              type="date"
              className="px-3 py-2 rounded-lg bg-black/40 border border-white/20 text-white"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              disabled={!selectedRFC}
            />
          </div>
        )}

        {/* Chat */}
        <div className="h-[28rem] overflow-y-auto rounded-xl p-4 bg-black/40 space-y-4 border border-white/10">
          {mensajes.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.25 }}
              className={`flex items-end gap-3 ${
                m.remitente === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {m.remitente === "bot" && (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/40">
                  <Bot size={18} className="text-white" />
                </div>
              )}

              <div
                className={`px-4 py-2 rounded-2xl max-w-xs whitespace-pre-line shadow-lg transition ${
                  m.remitente === "user"
                    ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-br-none"
                    : "bg-white/10 text-gray-100 border border-white/20 rounded-bl-none"
                }`}
              >
                {m.texto}
              </div>

              {m.remitente === "user" && (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-400 to-blue-400 flex items-center justify-center shadow-lg shadow-cyan-400/40">
                  <User size={18} className="text-white" />
                </div>
              )}
            </motion.div>
          ))}

          {/* 👇 Animación "escribiendo..." */}
          {cargando && (
            <div className="flex items-center gap-3 justify-start">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/40">
                <Bot size={18} className="text-white" />
              </div>
              <div className="px-4 py-2 rounded-2xl max-w-xs bg-white/10 text-gray-100 border border-white/20 rounded-bl-none flex gap-1">
                <motion.span
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                >
                  ●
                </motion.span>
                <motion.span
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                >
                  ●
                </motion.span>
                <motion.span
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                >
                  ●
                </motion.span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex gap-2 mt-4">
          <input
            type="text"
            className="flex-1 rounded-xl px-4 py-3 bg-black/40 border border-white/20 focus:outline-none focus:ring-2 focus:ring-cyan-400 text-white placeholder-gray-400"
            placeholder={
              selectedRFC
                ? "Escribe tu pregunta sobre facturas..."
                : "Selecciona primero un RFC"
            }
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && manejarEnvio()}
            disabled={!selectedRFC || cargando}
          />
          <button
            className={`px-5 py-3 rounded-xl font-semibold shadow-lg transition ${
              selectedRFC && !cargando
                ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:opacity-90"
                : "bg-gray-600 text-gray-400 cursor-not-allowed"
            }`}
            onClick={manejarEnvio}
            disabled={!selectedRFC || cargando}
          >
            {cargando ? "..." : "Enviar"}
          </button>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <Modal
          onClose={() => setShowModal(false)}
          onSelectRFC={(rfc) => {
            setSelectedRFC(rfc);
            setShowModal(false);
          }}
        />
      )}
    </main>
  );
}
