import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const NewRound = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<{ id: string; name: string }[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [playedAt, setPlayedAt] = useState(new Date().toISOString().split("T")[0]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("courses").select("id, name").eq("owner_id", user.id).order("name").then(({ data }) => {
      setCourses(data ?? []);
    });
  }, [user]);

  const handleCreate = async () => {
    if (!user || !selectedCourse) return;
    setCreating(true);

    // Get course holes to pre-populate round holes
    const { data: courseHoles } = await supabase
      .from("course_holes")
      .select("hole_number, par, meters_total")
      .eq("course_id", selectedCourse)
      .order("hole_number");

    if (!courseHoles || courseHoles.length === 0) {
      toast.error("Este campo no tiene hoyos configurados. Edítalo primero.");
      setCreating(false);
      return;
    }

    const { data: round, error } = await supabase
      .from("rounds")
      .insert({ owner_id: user.id, course_id: selectedCourse, played_at: playedAt })
      .select()
      .single();

    if (error || !round) {
      toast.error("Error al crear la ronda");
      setCreating(false);
      return;
    }

    // Create round_holes from course_holes
    const roundHoles = courseHoles.map((ch) => ({
      round_id: round.id,
      hole_number: ch.hole_number,
      hole_par: ch.par,
      hole_meters_total: ch.meters_total,
    }));

    await supabase.from("round_holes").insert(roundHoles);
    setCreating(false);
    navigate(`/rondas/${round.id}/hoyo/1`);
  };

  return (
    <AppLayout hideTabBar>
      <div className="mx-auto max-w-lg px-4 pt-4">
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/rondas")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Nueva Ronda</h1>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label>Campo</Label>
            {courses.length === 0 ? (
              <div className="rounded-xl border border-border bg-muted/50 p-4 text-center text-sm text-muted-foreground">
                <p>No tienes campos. Crea uno primero.</p>
                <Button variant="link" onClick={() => navigate("/campos")} className="mt-1">
                  Ir a Mis Campos
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {courses.map((c) => (
                  <Button
                    key={c.id}
                    variant="chip"
                    size="lg"
                    data-active={selectedCourse === c.id}
                    onClick={() => setSelectedCourse(c.id)}
                    className="justify-start"
                  >
                    {c.name}
                  </Button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Fecha</Label>
            <Input type="date" value={playedAt} onChange={(e) => setPlayedAt(e.target.value)} />
          </div>

          <Button
            onClick={handleCreate}
            disabled={!selectedCourse || creating}
            className="w-full"
            size="xl"
          >
            <Play className="mr-2 h-5 w-5" /> Comenzar Ronda
          </Button>
        </div>
      </div>
    </AppLayout>
  );
};

export default NewRound;
