import { useState } from 'react'
import {
  ArrowLeft, ArrowRight, ClipboardCheck, LayoutDashboard, Package, Settings,
  ShoppingCart, Tent, Users, Wallet, X,
} from 'lucide-react'
import { isLead } from '../auth'

// Per-user key: a device can be shared between sellers, so "seen it" must not
// leak from one account to the next.
export const tourKey = (userId) => `pos_tour_seen_${userId}`

export function hasSeenTour(user) {
  return localStorage.getItem(tourKey(user.id)) === '1'
}

// What each role actually needs to know on their first login. Sellers get the
// selling flow, leads additionally the review queue, admins the setup order.
function stepsFor(user) {
  const selling = [
    {
      Icon: Users,
      title: 'Wer kauft?',
      body: 'Zuerst den Teilnehmer wählen. Ohne Auswahl ist es ein Barverkauf – für Gäste, die nicht im Lager sind. Guthaben und Schulden gehen nur mit Teilnehmer.',
    },
    {
      Icon: ShoppingCart,
      title: 'Produkte antippen',
      body: 'Jeder Tipp legt das Produkt in den Warenkorb. Vertippt? Mit − und dem Mülleimer direkt auf der Produktkarte korrigieren – der Warenkorb muss dafür nicht geöffnet werden.',
    },
    {
      Icon: Wallet,
      title: 'Zahlung wählen',
      body: 'Bar, Guthaben oder Schulden – eine Art pro Verkauf. Bar muss den Betrag voll decken; fehlt etwas, sagt die Kasse es dir. Zu viel Bargeld kannst du als Guthaben stehen lassen („stimmt so").',
    },
  ]

  const reviewing = {
    Icon: ClipboardCheck,
    title: 'Fehler passieren',
    body: 'Ein Verkauf lässt sich stornieren. Storniert eine Verkäuferin, landet es unter „Prüfen" bei der Stand-Leitung – nichts verschwindet unbemerkt.',
  }

  // The Stand-Leitung (CAMP_LEAD) runs one camp: the setup checklist walks them through it.
  const lead = [
    {
      Icon: Settings,
      title: 'Camp einrichten',
      body: 'Die Checkliste auf der Admin-Seite führt durch die vier Schritte: Camp, Team, Produkte, Teilnehmer. Sie verschwindet, sobald alles steht.',
    },
    {
      Icon: Users,
      title: 'Team anlegen',
      body: 'Verkäufer:innen und weitere Stand-Leitungen bekommen ein temporäres Passwort, das sie beim ersten Login selbst ändern müssen. Gib es persönlich weiter.',
    },
    {
      Icon: Package,
      title: 'Produkte & Teilnehmer',
      body: 'Produkte mit Preis und Kategorie anlegen. Teilnehmer können Guthaben einzahlen oder anschreiben lassen – offene Schulden siehst du jederzeit im Überblick.',
    },
  ]

  // The super admin oversees EVERY camp - a guide, not a setup checklist.
  const superAdmin = [
    {
      Icon: LayoutDashboard,
      title: 'Du verwaltest alle Camps',
      body: 'In der Übersicht siehst du jedes Camp mit Umsatz, Teilnehmern, offenen Schulden und Kassenstand – die ganze Aktion auf einen Blick.',
    },
    {
      Icon: Tent,
      title: 'Camp anlegen',
      body: 'Lege im Admin-Bereich unter „Camps" ein neues Camp an – mit Name, Zeitraum und Startgeld für die Kasse.',
    },
    {
      Icon: Users,
      title: 'Stand-Leitung einladen',
      body: 'Erstelle für jedes Camp eine Stand-Leitung. Sie bekommt eine Checkliste, um ihr Camp einzurichten – oder du übernimmst die Einrichtung selbst.',
    },
    {
      Icon: ArrowRight,
      title: 'In ein Camp wechseln',
      body: 'Oben in der Leiste wählst du das aktive Camp. Teilnehmer, Produkte, Kasse und Verkäufe zeigen dann genau dieses Camp.',
    },
    {
      Icon: LayoutDashboard,
      title: 'Alles mitverfolgen',
      body: 'Über „Übersicht" behältst du jederzeit alle Camps im Blick – Umsätze, Schulden und Kassenstände laufen dort zusammen.',
    },
  ]

  if (user.role === 'SUPER_ADMIN') return superAdmin
  if (user.role === 'CAMP_LEAD') return lead
  return isLead(user) ? [...selling, reviewing] : selling
}

// Shown automatically the first time someone logs in, and re-openable any time
// from the account menu - the same information should not be a one-shot.
export default function OnboardingTour({ user, onClose }) {
  const steps = stepsFor(user)
  const [index, setIndex] = useState(0)
  const step = steps[index]
  const isLast = index === steps.length - 1

  function finish() {
    localStorage.setItem(tourKey(user.id), '1')
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl">
        <div className="flex items-center justify-between px-5 pt-4">
          <span className="text-xs font-semibold text-gray-400">
            Schritt {index + 1} von {steps.length}
          </span>
          <button onClick={finish} title="Überspringen" className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pb-2 pt-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary-soft text-primary flex items-center justify-center mx-auto mb-3">
            <step.Icon className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold">{step.title}</h2>
          <p className="text-sm text-gray-600 mt-1 leading-relaxed">{step.body}</p>
        </div>

        {/* progress dots double as a hint of how long this takes */}
        <div className="flex justify-center gap-1.5 py-3">
          {steps.map((s, i) => (
            <span
              key={s.title}
              className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-primary' : 'w-1.5 bg-gray-200'}`}
            />
          ))}
        </div>

        <div className="flex gap-2 p-4 border-t border-gray-100">
          {index > 0 && (
            <button onClick={() => setIndex(index - 1)}
                    className="border rounded-lg px-4 py-3 hover:bg-gray-50 flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Zurück
            </button>
          )}
          <button
            onClick={() => (isLast ? finish() : setIndex(index + 1))}
            className="flex-1 bg-primary text-white rounded-lg py-3 font-semibold flex items-center justify-center gap-1"
          >
            {isLast ? "Los geht's" : <>Weiter <ArrowRight className="w-4 h-4" /></>}
          </button>
        </div>
      </div>
    </div>
  )
}
