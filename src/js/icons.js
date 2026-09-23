import replaceElement from "lucide/replaceElement.mjs";

import GlassWater from "lucide/icons/glass-water.mjs";
import BottleWine from "lucide/icons/bottle-wine.mjs";
import Wallet from "lucide/icons/wallet.mjs";
import CircleCheck from "lucide/icons/circle-check.mjs";
import HandCoins from "lucide/icons/hand-coins.mjs";
import Banknote from "lucide/icons/banknote.mjs";
import Link from "lucide/icons/link.mjs";
import Check from "lucide/icons/check.mjs";
import Lock from "lucide/icons/lock.mjs";
import ShieldCheck from "lucide/icons/shield-check.mjs";
import Coins from "lucide/icons/coins.mjs";
import ScrollText from "lucide/icons/scroll-text.mjs";
import QrCode from "lucide/icons/qr-code.mjs";
import TriangleAlert from "lucide/icons/triangle-alert.mjs";
import ArrowUpRight from "lucide/icons/arrow-up-right.mjs";
import Upload from "lucide/icons/upload.mjs";
import MessageCircle from "lucide/icons/message-circle.mjs";
import Hash from "lucide/icons/hash.mjs";
import Send from "lucide/icons/send.mjs";
import ThumbsUp from "lucide/icons/thumbs-up.mjs";
import Download from "lucide/icons/download.mjs";
import Database from "lucide/icons/database.mjs";
import Share2 from "lucide/icons/share-2.mjs";
import Radio from "lucide/icons/radio.mjs";
import Music from "lucide/icons/music.mjs";
import ListMusic from "lucide/icons/list-music.mjs";
import Play from "lucide/icons/play.mjs";
import Pause from "lucide/icons/pause.mjs";
import Square from "lucide/icons/square.mjs";
import Volume2 from "lucide/icons/volume-2.mjs";
import VolumeX from "lucide/icons/volume-x.mjs";
import X from "lucide/icons/x.mjs";
import Receipt from "lucide/icons/receipt.mjs";
import FlaskConical from "lucide/icons/flask-conical.mjs";

export const ICONS = {
  GlassWater,
  BottleWine,
  Wallet,
  CircleCheck,
  HandCoins,
  Banknote,
  Link,
  Check,
  Lock,
  ShieldCheck,
  Coins,
  ScrollText,
  QrCode,
  TriangleAlert,
  ArrowUpRight,
  Upload,
  MessageCircle,
  Hash,
  Send,
  ThumbsUp,
  Download,
  Database,
  Share2,
  Radio,
  Music,
  ListMusic,
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  X,
  Receipt,
  FlaskConical,
};

/**
 * Reemplaza cada `<i data-lucide="…">` de `root` por el SVG de Lucide, y le
 * deja la clase `icon` (la que mide 1em y hereda el color del slot).
 *
 * Los atributos del marcador viajan al SVG: `replaceElement` copia los
 * atributos del `<i>` al `<svg>`, así que un icono puede seguir llevando
 * `data-attr` / `data-class` y lo sigue gobernando el pintado del componente.
 *
 * Se llama una sola vez, al montar. Volver a correrlo no rompe nada (vuelve a
 * dibujar el mismo SVG), pero no hace falta.
 *
 * @param {Element|ShadowRoot} root  dónde buscar los marcadores
 */
export function hydrateIcons(root) {
  for (const el of root.querySelectorAll("[data-lucide]")) {
    replaceElement(el, {
      nameAttr: "data-lucide",
      icons: ICONS,
      attrs: { class: "icon" },
    });
  }
}
