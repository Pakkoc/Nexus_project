"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, RotateCcw, Save, TrendingUp } from "lucide-react";

interface LevelRequirement {
  guildId: string;
  level: number;
  requiredXp: number;
}

// 기본 공식으로 계산 (level² × 100)
function getDefaultXpForLevel(level: number): number {
  return level * level * 100;
}

export default function LevelSettingsPage() {
  const params = useParams();
  const guildId = params["guildId"] as string;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [requirements, setRequirements] = useState<{ level: number; requiredXp: number }[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // 레벨 요구사항 조회
  const { data, isLoading } = useQuery<LevelRequirement[]>({
    queryKey: ["levelRequirements", guildId],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/xp/level-requirements`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  // 데이터 로드 시 로컬 상태 초기화
  useEffect(() => {
    if (data) {
      setRequirements(data.map(d => ({ level: d.level, requiredXp: d.requiredXp })));
      setHasChanges(false);
    }
  }, [data]);

  // 저장 mutation
  const saveMutation = useMutation({
    mutationFn: async (requirements: { level: number; requiredXp: number }[]) => {
      const res = await fetch(`/api/guilds/${guildId}/xp/level-requirements`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requirements),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["levelRequirements", guildId] });
      toast({
        title: "저장 완료",
        description: "레벨 설정이 저장되었습니다.",
      });
      setHasChanges(false);
    },
    onError: () => {
      toast({
        title: "저장 실패",
        description: "레벨 설정을 저장하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  // 레벨 추가
  const handleAddLevel = () => {
    const maxLevel = requirements.length > 0
      ? Math.max(...requirements.map(r => r.level))
      : 0;
    const newLevel = maxLevel + 1;
    setRequirements([
      ...requirements,
      { level: newLevel, requiredXp: getDefaultXpForLevel(newLevel) }
    ].sort((a, b) => a.level - b.level));
    setHasChanges(true);
  };

  // 레벨 삭제
  const handleRemoveLevel = (level: number) => {
    setRequirements(requirements.filter(r => r.level !== level));
    setHasChanges(true);
  };

  // XP 변경
  const handleXpChange = (level: number, xp: number) => {
    setRequirements(requirements.map(r =>
      r.level === level ? { ...r, requiredXp: xp } : r
    ));
    setHasChanges(true);
  };

  // 레벨 변경
  const handleLevelChange = (oldLevel: number, newLevel: number) => {
    if (newLevel < 1 || newLevel > 999) return;
    if (requirements.some(r => r.level === newLevel && r.level !== oldLevel)) {
      toast({
        title: "중복 레벨",
        description: "이미 존재하는 레벨입니다.",
        variant: "destructive",
      });
      return;
    }
    setRequirements(requirements.map(r =>
      r.level === oldLevel ? { ...r, level: newLevel } : r
    ).sort((a, b) => a.level - b.level));
    setHasChanges(true);
  };

  // 기본값으로 초기화 (1~10 레벨)
  const handleResetToDefault = () => {
    const defaultRequirements = [];
    for (let i = 1; i <= 10; i++) {
      defaultRequirements.push({
        level: i,
        requiredXp: getDefaultXpForLevel(i),
      });
    }
    setRequirements(defaultRequirements);
    setHasChanges(true);
  };

  // 전체 삭제 (기본 공식 사용)
  const handleClearAll = () => {
    setRequirements([]);
    setHasChanges(true);
  };

  // 저장
  const handleSave = () => {
    saveMutation.mutate(requirements);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-700" />
        <Card className="animate-pulse border-slate-700 bg-slate-800/50">
          <CardContent className="py-8">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 rounded bg-slate-700" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">레벨 설정</h1>
          <p className="text-slate-400">각 레벨에 필요한 XP를 설정합니다.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleResetToDefault}
            className="border-slate-600"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            기본값
          </Button>
          <Button
            onClick={handleAddLevel}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            레벨 추가
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <Card className="border-blue-500/30 bg-blue-500/10">
        <CardContent className="py-4">
          <p className="text-sm text-blue-300">
            <strong>기본 공식:</strong> 레벨² × 100 (예: 레벨 5 = 2,500 XP)
            <br />
            커스텀 설정이 없으면 기본 공식이 적용됩니다.
          </p>
        </CardContent>
      </Card>

      {/* Level Requirements Table */}
      <Card className="border-slate-700 bg-slate-800/50">
        <CardHeader>
          <CardTitle className="text-white">레벨별 필요 XP</CardTitle>
          <CardDescription>
            {requirements.length > 0
              ? `${requirements.length}개의 커스텀 레벨이 설정되어 있습니다.`
              : "커스텀 설정이 없습니다. 기본 공식이 적용됩니다."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {requirements.length > 0 ? (
            <div className="space-y-3">
              {/* Header */}
              <div className="grid grid-cols-12 gap-4 px-4 text-sm font-medium text-slate-400">
                <div className="col-span-3">레벨</div>
                <div className="col-span-4">필요 XP</div>
                <div className="col-span-3">기본값</div>
                <div className="col-span-2"></div>
              </div>

              {/* Rows */}
              {requirements.map((req) => (
                <div
                  key={req.level}
                  className="grid grid-cols-12 items-center gap-4 rounded-lg border border-slate-700 p-4"
                >
                  <div className="col-span-3">
                    <Input
                      type="number"
                      min="1"
                      max="999"
                      value={req.level}
                      onChange={(e) => handleLevelChange(req.level, parseInt(e.target.value) || 1)}
                      className="w-24 border-slate-700 bg-slate-900"
                    />
                  </div>
                  <div className="col-span-4">
                    <Input
                      type="number"
                      min="0"
                      value={req.requiredXp}
                      onChange={(e) => handleXpChange(req.level, parseInt(e.target.value) || 0)}
                      className="border-slate-700 bg-slate-900"
                    />
                  </div>
                  <div className="col-span-3 text-slate-500">
                    {getDefaultXpForLevel(req.level).toLocaleString()} XP
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveLevel(req.level)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <TrendingUp className="mx-auto h-12 w-12 text-slate-600" />
              <p className="mt-4 text-slate-400">커스텀 레벨 설정이 없습니다.</p>
              <p className="text-sm text-slate-500">
                기본 공식(레벨² × 100)이 적용됩니다.
              </p>
              <div className="mt-4 flex justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleResetToDefault}
                  className="border-slate-600"
                >
                  기본값으로 시작
                </Button>
                <Button
                  onClick={handleAddLevel}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  직접 추가
                </Button>
              </div>
            </div>
          )}

          {/* Clear All Button */}
          {requirements.length > 0 && (
            <div className="mt-4 flex justify-between border-t border-slate-700 pt-4">
              <Button
                variant="ghost"
                onClick={handleClearAll}
                className="text-slate-400 hover:text-slate-300"
              >
                전체 삭제 (기본 공식 사용)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      {hasChanges && (
        <div className="fixed bottom-6 right-6">
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="bg-green-600 hover:bg-green-700 shadow-lg"
            size="lg"
          >
            <Save className="mr-2 h-4 w-4" />
            {saveMutation.isPending ? "저장 중..." : "변경사항 저장"}
          </Button>
        </div>
      )}
    </div>
  );
}
