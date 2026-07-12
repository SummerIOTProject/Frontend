"use client";

import { Camera, ImagePlus, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { validateImageFile } from "@/lib/validation/image";

export interface PhotoSelection {
  file: File;
  previewUrl: string;
}

export function PhotoDropzone({ label, description, value, onChange, disabled = false }: { label: string; description: string; value: PhotoSelection | null; onChange: (value: PhotoSelection | null) => void; disabled?: boolean }) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => () => { if (value?.previewUrl) URL.revokeObjectURL(value.previewUrl); }, [value]);

  const selectFile = (file?: File) => {
    if (!file) return;
    const message = validateImageFile(file);
    if (message) { setError(message); return; }
    if (value?.previewUrl) URL.revokeObjectURL(value.previewUrl);
    setError(null);
    onChange({ file, previewUrl: URL.createObjectURL(file) });
  };

  return (
    <section className="photo-field" aria-labelledby={`${inputId}-label`}>
      <div className="photo-field-heading"><div><span className="photo-step"><Camera size={14} />{label}</span><p id={`${inputId}-label`}>{description}</p></div>{value && <span className="ready-label">등록 완료</span>}</div>
      <div
        className={`dropzone ${dragging ? "dragging" : ""} ${value ? "has-preview" : ""}`}
        onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); if (!disabled) selectFile(event.dataTransfer.files[0]); }}
      >
        <input ref={inputRef} id={inputId} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { selectFile(event.target.files?.[0]); event.currentTarget.value = ""; }} disabled={disabled} aria-label={`${label} 선택`} />
        {value ? (
          <div className="image-preview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value.previewUrl} alt={`${label} 미리보기`} />
            <div className="preview-overlay"><span>{value.file.name}</span><small>{(value.file.size / 1024 / 1024).toFixed(1)}MB</small></div>
          </div>
        ) : (
          <button type="button" className="dropzone-prompt" onClick={() => inputRef.current?.click()} disabled={disabled}>
            <span className="dropzone-icon"><UploadCloud size={26} /></span>
            <strong>사진을 끌어놓거나 선택해 주세요</strong>
            <span>JPG, PNG, WebP · 최대 10MB</span>
            <span className="button secondary small"><ImagePlus size={16} />사진 선택</span>
          </button>
        )}
      </div>
      {value && <div className="photo-actions"><button type="button" className="text-button" onClick={() => inputRef.current?.click()} disabled={disabled}><RefreshCw size={15} />사진 교체</button><button type="button" className="text-button danger" onClick={() => { if (value.previewUrl) URL.revokeObjectURL(value.previewUrl); onChange(null); }} disabled={disabled}><Trash2 size={15} />삭제</button></div>}
      {error && <p className="field-error" role="alert">{error}</p>}
    </section>
  );
}
