"use client";
import NextImage from "next/image";
import { useEffect, useRef, useState } from "react";

const cabStyles = [
  {
    id: "gr501e",
    name: "GR501e",
    image: "/assets/images/GR501e.png",
  },
  {
    id: "gr503e",
    name: "GR503e",
    image: "/assets/images/GR503e.png",
  },
];

const finishes = [
  {
    id: "walnut",
    name: "Walnut Heights",
    image: "/assets/images/walnutheights.png",
  },
  {
    id: "wild",
    name: "Wild Cherry",
    image: "/assets/images/wildcherry.png",
  },
  {
    id: "williamsburg",
    name: "Williamsburg Cherry",
    image: "/assets/images/williamsburgcherry.png",
  },
];

const steps = [
  { id: "style", label: "Style", icon: "📦" },
  { id: "finish", label: "Finishes", icon: "🎨" },
  { id: "project", label: "Project Info", icon: "📋" },
];

/* ================= COMPONENT ================= */

export default function Home() {
  const [activeStep, setActiveStep] = useState(2);
  const formRef = useRef<HTMLFormElement | null>(null);

  const [selectedCab, setSelectedCab] = useState(cabStyles[0].id);
  const [selectedUpperFinish, setSelectedUpperFinish] = useState<string | null>(
    null,
  );
  // Lower finish state removed
  const [selectedHandrail, setSelectedHandrail] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleGeneratePDF = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canvasRef.current || !formRef.current) return;

    // dynamic import (SSR safe)
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF("p", "mm", "a4");

    const formData = new FormData(formRef.current);

    let y = 20;

    doc.setFontSize(16);
    doc.text("Elevator Cab Configuration", 14, y);
    y += 10;

    doc.setFontSize(11);

    formData.forEach((value, key) => {
      doc.text(`${key}: ${value}`, 14, y);
      y += 7;
    });

    y += 10;

    // Add canvas image
    const imgData = canvasRef.current.toDataURL("image/png", 1.0);
    doc.addImage(imgData, "PNG", 14, y, 180, 120);

    doc.save("Elevator-Cab-Configuration.pdf");
  };

  const currentCab =
    cabStyles.find((cab) => cab.id === selectedCab) || cabStyles[0];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let isCancelled = false;

    const loadImage = (src: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new window.Image();
        img.src = src;
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
      });

    const draw = async () => {
      try {
        // Match canvas pixels to displayed size (HiDPI-safe)
        const dpr = window.devicePixelRatio || 1;
        const displayWidth = canvas.clientWidth || 600;
        const displayHeight = canvas.clientHeight || 800;
        const width = Math.max(1, Math.round(displayWidth * dpr));
        const height = Math.max(1, Math.round(displayHeight * dpr));

        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        ctx.clearRect(0, 0, width, height);

        const drawImageCover = (
          img: HTMLImageElement,
          dx: number,
          dy: number,
          dw: number,
          dh: number,
        ) => {
          const iw = img.naturalWidth || img.width;
          const ih = img.naturalHeight || img.height;
          if (!iw || !ih) return;

          const scale = Math.max(dw / iw, dh / ih);
          const sw = dw / scale;
          const sh = dh / scale;
          const sx = (iw - sw) / 2;
          const sy = (ih - sh) / 2;
          ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
        };

        // Helper to draw a textured polygon
        const drawTexturedPolygon = (
          img: HTMLImageElement,
          points: { x: number; y: number }[],
        ) => {
          const ptsPx = points.map((p) => ({
            x: p.x * width,
            y: p.y * height,
          }));

          let minX = Infinity;
          let minY = Infinity;
          let maxX = -Infinity;
          let maxY = -Infinity;

          for (const p of ptsPx) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
          }

          ctx.save();
          ctx.beginPath();

          ptsPx.forEach((p, idx) => {
            if (idx === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          });

          ctx.closePath();
          ctx.clip();

          ctx.globalCompositeOperation = "multiply";
          ctx.globalAlpha = 1;

          // Calculate bounding box
          const boxWidth = maxX - minX;
          const boxHeight = maxY - minY;

          // Scale texture ONLY for this wall
          const iw = img.width;
          const ih = img.height;

          const scale = Math.max(boxWidth / iw, boxHeight / ih);
          const dw = iw * scale;
          const dh = ih * scale;

          ctx.drawImage(
            img,
            minX + (boxWidth - dw) / 2,
            minY + (boxHeight - dh) / 2,
            dw,
            dh,
          );

          ctx.restore();
        };

        // 1) Draw the base cab first
        const cabImg = await loadImage(currentCab.image);
        if (isCancelled) return;
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
        ctx.drawImage(cabImg, 0, 0, width, height);

        // Upper finish -> three wall panels
        if (selectedUpperFinish) {
          const upperImg = await loadImage(selectedUpperFinish);
          if (isCancelled) return;

          const HEIGHT_OFFSET = 0.04;
          const BOTTOM_OFFSET = 0.05; // increase bottom here
          const EDGE_FIX = 0.003;

          const topLeftY = 0.005 - HEIGHT_OFFSET;
          const topBackY = 0.23 - HEIGHT_OFFSET;
          const bottomBackY = 0.79 + BOTTOM_OFFSET;
          const bottomLeftY = 0.995 + BOTTOM_OFFSET;

          // left wall
          drawTexturedPolygon(upperImg, [
            { x: 0.01 - EDGE_FIX, y: topLeftY },
            { x: 0.22 + EDGE_FIX, y: topBackY },
            { x: 0.22 + EDGE_FIX, y: bottomBackY },
            { x: 0.01 - EDGE_FIX, y: bottomLeftY },
          ]);

          // Back wall

          const innerLeftX = 0.22 + EDGE_FIX;
          const innerRightX = 0.795 - EDGE_FIX;

          const BACK_TOP_REDUCE = 0.02; // increase to reduce more from top

          drawTexturedPolygon(upperImg, [
            { x: innerLeftX, y: topBackY + BACK_TOP_REDUCE },
            { x: innerRightX, y: topBackY + BACK_TOP_REDUCE },
            { x: innerRightX, y: bottomBackY - 0.025 },
            { x: innerLeftX, y: bottomBackY - 0.025 },
          ]);

          // Right wall
          drawTexturedPolygon(upperImg, [
            { x: 0.795 - EDGE_FIX, y: topBackY },
            { x: 0.99 + EDGE_FIX, y: topLeftY },
            { x: 0.99 + EDGE_FIX, y: bottomLeftY },
            { x: 0.795 - EDGE_FIX, y: bottomBackY },
          ]);
        }

        // Removed lower finish drawing

        // Handrail overlay (simple centered draw)
        if (selectedHandrail) {
          const railImg = await loadImage(selectedHandrail);
          if (isCancelled) return;

          const railWidth = width * 0.7;
          const railHeight = (railImg.height / railImg.width) * railWidth;
          const x = (width - railWidth) / 2;
          const y = height * 0.58;

          ctx.save();
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = "source-over";
          ctx.drawImage(railImg, x, y, railWidth, railHeight);
          ctx.restore();
        }
      } catch {
        // fail silently for now
      }
    };

    void draw();

    return () => {
      isCancelled = true;
    };
  }, [currentCab.image, selectedUpperFinish, selectedHandrail]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* HEADER */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <h1 className="text-3xl font-bold text-gray-900">
            G&R Custom Elevator Cabs
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            Design your perfect elevator cabin
          </p>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* STEP INDICATOR */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <button
                  onClick={() => setActiveStep(index)}
                  className={`flex items-center justify-center w-12 h-12 rounded-full font-semibold text-lg transition-all ${
                    activeStep === index
                      ? "bg-blue-600 text-white shadow-md"
                      : activeStep > index
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {activeStep > index ? "✓" : step.icon}
                </button>
                <p
                  className={`ml-3 text-sm font-medium ${
                    activeStep === index ? "text-blue-600" : "text-gray-600"
                  }`}
                >
                  {step.label}
                </p>
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-4 rounded-full ${
                      activeStep > index ? "bg-green-200" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT SECTION - CONTENT */}
          <div className="lg:col-span-1">
            {/* CAB STYLE STEP */}
            {activeStep === 0 && (
              <div className="bg-white rounded-lg shadow-sm p-8">
                <h2 className="text-xl font-bold text-gray-900 mb-6">
                  Choose Your Cab Style
                </h2>
                <div className="grid grid-cols-3 gap-6">
                  {cabStyles.map((cab) => (
                    <button
                      key={cab.id}
                      onClick={() => setSelectedCab(cab.id)}
                      className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                        selectedCab === cab.id
                          ? "border-blue-600 ring-2 ring-blue-300"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="w-full aspect-square bg-gray-200 overflow-hidden">
                        <img
                          src={cab.image}
                          alt={cab.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-white font-semibold">
                          {cab.name}
                        </span>
                      </div>
                      <p className="text-center py-3 font-medium text-gray-900">
                        {cab.name}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* FINISH STEP */}
            {activeStep === 1 && (
              <div className="bg-white rounded-lg shadow-sm p-8">
                <h2 className="text-xl font-bold text-gray-900 mb-6">
                  Choose Upper Finish
                </h2>
                <div className="grid grid-cols-3 gap-4">
                  {finishes.map((finish) => (
                    <button
                      key={finish.id}
                      onClick={() => setSelectedUpperFinish(finish.image)}
                      className={`rounded-lg overflow-hidden border-2 transition-all ${
                        selectedUpperFinish === finish.image
                          ? "border-blue-600 ring-2 ring-blue-300"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="w-full aspect-square bg-gray-200 overflow-hidden">
                        <img
                          src={finish.image}
                          alt={finish.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <p className="text-center py-2 text-sm font-medium text-gray-900">
                        {finish.name}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* PROJECT FORM STEP */}
            {activeStep === 2 && (
              <div className="bg-white rounded-lg shadow-sm p-8">
                <h2 className="text-xl font-bold text-gray-900 mb-6">
                  Project Information
                </h2>
                <form
                  ref={formRef}
                  onSubmit={handleGeneratePDF}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Company Name *
                      </label>
                      <input
                        name="Company Name"
                        required
                        type="text"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                        placeholder="Enter company name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Contact Name *
                      </label>
                      <input
                        name="Contact Name"
                        required
                        type="text"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                        placeholder="Enter contact name"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <input
                        name="Email Id"
                        type="email"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                        placeholder="Enter email"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone *
                      </label>
                      <input
                        name="Phone"
                        required
                        type="tel"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                        placeholder="Enter phone number"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Project Name *
                      </label>
                      <input
                        name="Project Name"
                        required
                        type="text"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                        placeholder="Enter project name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cab Name *
                      </label>
                      <input
                        name="Cab Name"
                        required
                        type="text"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                        placeholder="Enter cab name"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cab Size *
                    </label>
                    <select
                      name="Cab Size"
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition bg-white"
                    >
                      <option value="">Select cab size</option>
                      <option value="1500">1500 lbs (68" x 48" x 96")</option>
                      <option value="2000">2000 lbs (72" x 54" x 96")</option>
                      <option value="2500">2500 lbs (80" x 54" x 96")</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Width (in) *
                      </label>
                      <input
                        name="Cab Width"
                        required
                        type="number"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                        placeholder="Width"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Depth (in) *
                      </label>
                      <input
                        name="Cab Depth"
                        required
                        type="number"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                        placeholder="Depth"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Height (in) *
                      </label>
                      <input
                        name="Cab Height"
                        required
                        type="number"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                        placeholder="Height"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Project Address *
                    </label>
                    <input
                      name="Project Address"
                      required
                      type="text"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                      placeholder="Enter project address"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Zip Code *
                      </label>
                      <input
                        name="Zip Code"
                        required
                        type="text"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                        placeholder="Enter zip code"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Shipping Contact *
                      </label>
                      <input
                        name="Shipping Contact"
                        required
                        type="text"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                        placeholder="Enter shipping contact"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Shipping Address
                    </label>
                    <input
                      name="Shipping Address"
                      type="text"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                      placeholder="Enter shipping address (optional)"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Shipping Zip Code *
                    </label>
                    <input
                      name="Shipping Zip Code"
                      required
                      type="text"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                      placeholder="Enter shipping zip code"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors mt-6"
                  >
                    Generate PDF & Submit
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* RIGHT PREVIEW */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-24">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Preview</h3>
              <div className="bg-gray-100 rounded-lg overflow-hidden border border-gray-300">
                <canvas ref={canvasRef} className="w-full block" />
              </div>
              <div className="mt-4 text-sm text-gray-600 space-y-2">
                <p>
                  <span className="font-semibold text-gray-900">Style:</span>{" "}
                  {cabStyles.find((c) => c.id === selectedCab)?.name}
                </p>
                <p>
                  <span className="font-semibold text-gray-900">Finish:</span>{" "}
                  {finishes.find((f) => f.image === selectedUpperFinish)?.name}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
