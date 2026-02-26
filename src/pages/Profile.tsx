import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogOut, Save } from "lucide-react";

const Profile = () => {
  const { user, signOut } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.display_name) setDisplayName(data.display_name);
      });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ display_name: displayName }).eq("id", user.id);
    setSaving(false);
    if (error) toast.error("Error al guardar");
    else toast.success("Guardado");
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-lg px-4 pt-12">
        <h1 className="mb-6 text-2xl font-bold">Perfil</h1>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email ?? ""} disabled />
          </div>
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Tu nombre" />
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
            <Save className="mr-2 h-4 w-4" /> Guardar
          </Button>
          <Button onClick={signOut} variant="outline" className="w-full" size="lg">
            <LogOut className="mr-2 h-4 w-4" /> Cerrar Sesión
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default Profile;
