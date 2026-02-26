import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";

interface HoleData {
  hole_number: number;
  par: number;
  meters_total: number;
}

const CourseEditor = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const [courseName, setCourseName] = useState("");
  const [holes, setHoles] = useState<HoleData[]>(
    Array.from({ length: 18 }, (_, i) => ({ hole_number: i + 1, par: 4, meters_total: 350 }))
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!courseId) return;
    supabase.from("courses").select("name").eq("id", courseId).single().then(({ data }) => {
      if (data) setCourseName(data.name);
    });
    supabase.from("course_holes").select("*").eq("course_id", courseId).order("hole_number").then(({ data }) => {
      if (data && data.length > 0) {
        setHoles(data.map((h) => ({ hole_number: h.hole_number, par: h.par, meters_total: h.meters_total })));
      }
    });
  }, [courseId]);

  const updateHole = (idx: number, field: "par" | "meters_total", value: number) => {
    setHoles((prev) => prev.map((h, i) => (i === idx ? { ...h, [field]: value } : h)));
  };

  const handleSave = async () => {
    if (!courseId) return;
    setSaving(true);

    // Update course name
    await supabase.from("courses").update({ name: courseName }).eq("id", courseId);

    // Upsert holes
    const holesData = holes.map((h) => ({
      course_id: courseId,
      hole_number: h.hole_number,
      par: h.par,
      meters_total: h.meters_total,
    }));

    // Delete existing and re-insert
    await supabase.from("course_holes").delete().eq("course_id", courseId);
    const { error } = await supabase.from("course_holes").insert(holesData);

    setSaving(false);
    if (error) toast.error("Error al guardar");
    else toast.success("Campo guardado");
  };

  return (
    <AppLayout hideTabBar>
      <div className="mx-auto max-w-lg px-4 pt-4">
        <div className="mb-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/campos")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Input
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
            className="text-lg font-bold"
            placeholder="Nombre del campo"
          />
        </div>

        <div className="mb-4 rounded-xl border border-border bg-card">
          <div className="grid grid-cols-[3rem_1fr_1fr] gap-0 border-b border-border p-3 text-xs font-semibold text-muted-foreground">
            <span>Hoyo</span>
            <span className="text-center">Par</span>
            <span className="text-center">Metros</span>
          </div>
          {holes.map((hole, idx) => (
            <div key={hole.hole_number} className="grid grid-cols-[3rem_1fr_1fr] items-center gap-2 border-b border-border/50 px-3 py-2 last:border-0">
              <span className="text-sm font-bold text-primary">{hole.hole_number}</span>
              <div className="flex items-center justify-center gap-1">
                {[3, 4, 5].map((p) => (
                  <Button
                    key={p}
                    variant="chip"
                    size="chip"
                    data-active={hole.par === p}
                    onClick={() => updateHole(idx, "par", p)}
                  >
                    {p}
                  </Button>
                ))}
              </div>
              <Input
                type="number"
                value={hole.meters_total}
                onChange={(e) => updateHole(idx, "meters_total", parseInt(e.target.value) || 0)}
                className="h-8 text-center text-sm"
              />
            </div>
          ))}
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
          <Save className="mr-2 h-4 w-4" /> Guardar Campo
        </Button>
      </div>
    </AppLayout>
  );
};

export default CourseEditor;
