import { useMemo, useState } from "react";
import { Lock, AlertTriangle, Eye, EyeOff, Copy, CheckCircle } from "lucide-react";
import {
  verifyRotatingPassword,
  verifyActivationCode,
  getDeviceId,
} from "@/lib/activation";
import { verifyManagerCredentials, isManagerCredsSet } from "@/lib/store";
import { normalizeSecret } from "@/lib/normalizeSecret";

interface Props {
  title?: string;
  hint?: string;
  mode?: "rotating" | "manager" | "activation";
  onSuccess: () => void;
  onCancel?: () => void;
}

/**
 * Gate that requires one of:
 *  - the current rotating password (changes every 5 minutes)
 *  - the saved manager username/password (once set)
 *  - the device activation code (stable per-device, from admin)
 *
 * Modes:
 *   'rotating'   -> asks for the rotating password OR the device activation code.
 *   'manager'    -> asks for the saved manager username/password.
 *   'activation' -> shows the device code and asks for the device activation code.
 */
const PasswordGate = ({
  title = "كلمة المرور",
  hint,
  mode = "rotating",
  onSuccess,
  onCancel,
}: Props) => {
  const [value, setValue] = useState("");
  const [username, setUsername] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const managerReady = isManagerCredsSet();
  const deviceId = useMemo(() => (mode === "activation" ? getDeviceId() : ""), [mode]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const pw = normalizeSecret(value);
    const user = normalizeSecret(username);
    setErr("");

    if (mode === "manager") {
      if (managerReady && verifyManagerCredentials(user, pw)) {
        onSuccess();
        return;
      }
      setErr("اسم المستخدم أو كلمة المرور غير صحيحة.");
      return;
    }

    if (mode === "activation") {
      if (verifyActivationCode(value, deviceId)) {
        onSuccess();
      } else {
        setErr("كود التفعيل غير صحيح.");
      }
      return;
    }

    // rotating mode: accept rotating password, manager creds, OR activation code
    if (verifyRotatingPassword(pw)) {
      onSuccess();
    } else if (managerReady && verifyManagerCredentials(user, pw)) {
      onSuccess();
    } else if (verifyActivationCode(value)) {
      onSuccess();
    } else {
      setErr(
        managerReady
          ? "اسم أو كلمة مرور مدير الفروع غير صحيحة، أو الكود المُدخل خطأ."
          : "كلمة المرور أو كود التفعيل غير صحيح.",
      );
    }
  };

  const handleCopyDeviceId = async () => {
    try {
      await navigator.clipboard.writeText(deviceId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const isManagerMode = mode === "manager";
  const isActivationMode = mode === "activation";

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-card border border-border rounded-xl p-6 space-y-4"
      >
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-full bg-supermarket/20 flex items-center justify-center">
            <Lock className="w-7 h-7 text-supermarket" />
          </div>
          <h3 className="font-cairo font-black text-lg">{title}</h3>
          <p className="text-xs text-muted-foreground font-cairo leading-6">
            {hint ||
              (isActivationMode
                ? "أعطِ كود الجهاز للمصمم Ahmed واحصل على كود التفعيل، ثم أدخله هنا."
                : isManagerMode
                  ? "أدخل اسم مستخدم وكلمة مرور مدير الفروع المحفوظين على هذا الجهاز."
                  : managerReady
                    ? "اكتب اسم مستخدم وكلمة مرور مدير الفروع، أو كود التفعيل الخاص بالجهاز."
                    : "اكتب كود التفعيل الخاص بالجهاز.")}
          </p>
        </div>

        {isActivationMode && (
          <div className="p-3 bg-secondary rounded-lg space-y-1">
            <label className="font-cairo text-xs text-muted-foreground block">
              كود الجهاز الخاص بك:
            </label>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-lg tracking-widest text-foreground flex-1 text-center">
                {deviceId}
              </span>
              <button
                type="button"
                onClick={handleCopyDeviceId}
                className="p-2 rounded hover:bg-muted transition-colors"
                title="نسخ"
              >
                {copied ? <CheckCircle className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {!isActivationMode && (isManagerMode || managerReady) && (
          <input
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setErr("");
            }}
            placeholder={
              isManagerMode ? "اسم مستخدم مدير الفروع" : "اسم مستخدم مدير الفروع (اختياري)"
            }
            autoComplete="username"
            className="w-full h-11 px-3 bg-secondary rounded font-cairo text-center focus:outline-none focus:ring-2 focus:ring-supermarket"
          />
        )}

        <div className="relative">
          <input
            type={show || isActivationMode ? "text" : "password"}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setErr("");
            }}
            placeholder={isActivationMode ? "أدخل كود التفعيل..." : "••••••••"}
            autoFocus
            className="w-full h-11 px-3 pl-10 bg-secondary rounded font-mono text-center focus:outline-none focus:ring-2 focus:ring-supermarket"
          />
          {!isActivationMode && (
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
        </div>

        {err && (
          <div className="flex items-center gap-2 p-2 bg-destructive/10 text-destructive rounded text-xs font-cairo">
            <AlertTriangle className="w-4 h-4" /> {err}
          </div>
        )}

        <div className="flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2 rounded bg-secondary text-muted-foreground font-cairo font-bold text-sm"
            >
              رجوع
            </button>
          )}
          <button
            type="submit"
            className="flex-1 py-2 rounded bg-supermarket text-supermarket-foreground font-cairo font-bold text-sm"
          >
            دخول
          </button>
        </div>
      </form>
    </div>
  );
};

export default PasswordGate;
