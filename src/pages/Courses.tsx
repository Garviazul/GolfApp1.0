import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, ChevronRight, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface Course {
  id: string;
  name: string;
  created_at: string;
  total_par: number;
}

const Courses = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [showNew, setShowNew] = useState(false);

  const fetchCourses = async () => {
    if (!user) return;
    const { data: rawCourses } = await supabase
      .from("courses")
      .select("id, name, created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    const baseCourses = (rawCourses ?? []).map((course) => ({ ...course, total_par: 0 }));
    if (baseCourses.length === 0) {
      setCourses([]);
      setLoading(false);
      return;
    }

    const courseIds = baseCourses.map((course) => course.id);
    const { data: holes } = await supabase
      .from("course_holes")
      .select("course_id, par")
      .in("course_id", courseIds);

    const parByCourse = (holes ?? []).reduce<Record<string, number>>((acc, hole) => {
      acc[hole.course_id] = (acc[hole.course_id] ?? 0) + hole.par;
      return acc;
    }, {});

    setCourses(
      baseCourses.map((course) => ({
        ...course,
        total_par: parByCourse[course.id] ?? 0,
      }))
    );
    setLoading(false);
  };

  useEffect(() => { fetchCourses(); }, [user]);

  const handleCreate = async () => {
    if (!user || !newName.trim()) return;
    const { data, error } = await supabase.from("courses").insert({ name: newName.trim(), owner_id: user.id }).select().single();
    if (error) { toast.error("Error al crear"); return; }
    setNewName("");
    setShowNew(false);
    navigate(`/campos/${data.id}`);
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-lg px-4 pt-12">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Mis Campos</h1>
          <Button size="sm" onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4" /> Nuevo
          </Button>
        </div>

        {showNew && (
          <div className="mb-4 flex gap-2 animate-fade-in">
            <Input
              placeholder="Nombre del campo"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
            <Button onClick={handleCreate}>Crear</Button>
            <Button variant="ghost" onClick={() => setShowNew(false)}>✕</Button>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}
          </div>
        ) : courses.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <MapPin className="mx-auto mb-3 h-10 w-10 opacity-40" />
            <p className="font-medium">Sin campos aún</p>
            <p className="text-sm">Crea tu primer campo para empezar</p>
          </div>
        ) : (
          <div className="space-y-2">
            {courses.map((c) => (
              <button
                key={c.id}
                onClick={() => navigate(`/campos/${c.id}`)}
                className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-secondary tap-highlight-none active:scale-[0.98]"
              >
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.total_par > 0 ? `Par ${c.total_par}` : "Sin hoyos"}
                    {" · "}
                    {new Date(c.created_at).toLocaleDateString("es-ES")}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Courses;
