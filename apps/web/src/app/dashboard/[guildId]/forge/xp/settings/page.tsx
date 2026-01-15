"use client";

import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useXpSettings, useUpdateXpSettings } from "@/hooks/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useUnsavedChanges } from "@/contexts/unsaved-changes-context";
import { Icon } from "@iconify/react";

// XP Settings Schema
const xpSettingsFormSchema = z.object({
  textXpEnabled: z.boolean(),
  textXpMin: z.coerce.number().min(0).max(1000),
  textXpMax: z.coerce.number().min(0).max(1000),
  textCooldownSeconds: z.coerce.number().min(0).max(3600),
  textMaxPerCooldown: z.coerce.number().min(1).max(100),
  voiceXpEnabled: z.boolean(),
  voiceXpMin: z.coerce.number().min(0).max(1000),
  voiceXpMax: z.coerce.number().min(0).max(1000),
  voiceCooldownSeconds: z.coerce.number().min(0).max(3600),
  voiceMaxPerCooldown: z.coerce.number().min(1).max(100),
});

type XpSettingsFormValues = z.infer<typeof xpSettingsFormSchema>;

// Level Requirements
interface LevelRequirement {
  guildId: string;
  type: 'text' | 'voice';
  level: number;
  requiredXp: number;
}

type XpType = 'text' | 'voice';

function getDefaultXpForLevel(level: number): number {
  return level * level * 100;
}

export default function XpSettingsPage() {
  const params = useParams();
  const guildId = params["guildId"] as string;
  const { toast } = useToast();
  const { setHasUnsavedChanges } = useUnsavedChanges();
  const queryClient = useQueryClient();

  // XP Settings State
  const { data: settings, isLoading: settingsLoading } = useXpSettings(guildId);
  const updateSettings = useUpdateXpSettings(guildId);

  const form = useForm<XpSettingsFormValues>({
    resolver: zodResolver(xpSettingsFormSchema),
    defaultValues: {
      textXpEnabled: true,
      textXpMin: 15,
      textXpMax: 25,
      textCooldownSeconds: 60,
      textMaxPerCooldown: 1,
      voiceXpEnabled: true,
      voiceXpMin: 10,
      voiceXpMax: 20,
      voiceCooldownSeconds: 60,
      voiceMaxPerCooldown: 1,
    },
  });

  const formIsDirty = form.formState.isDirty;

  useEffect(() => {
    if (settings) {
      form.reset({
        textXpEnabled: Boolean(settings.textXpEnabled),
        textXpMin: settings.textXpMin,
        textXpMax: settings.textXpMax,
        textCooldownSeconds: settings.textCooldownSeconds,
        textMaxPerCooldown: settings.textMaxPerCooldown,
        voiceXpEnabled: Boolean(settings.voiceXpEnabled),
        voiceXpMin: settings.voiceXpMin,
        voiceXpMax: settings.voiceXpMax,
        voiceCooldownSeconds: settings.voiceCooldownSeconds,
        voiceMaxPerCooldown: settings.voiceMaxPerCooldown,
      });
    }
  }, [settings, form]);

  const onSubmitXpSettings = async (data: XpSettingsFormValues) => {
    try {
      await updateSettings.mutateAsync(data);
      form.reset(data);
      toast({
        title: "설정 저장 완료",
        description: "XP 설정이 저장되었습니다.",
      });
    } catch {
      toast({
        title: "저장 실패",
        description: "설정을 저장하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  // Level Requirements State
  const [textRequirements, setTextRequirements] = useState<{ level: number; requiredXp: number }[]>([]);
  const [voiceRequirements, setVoiceRequirements] = useState<{ level: number; requiredXp: number }[]>([]);
  const [textHasChanges, setTextHasChanges] = useState(false);
  const [voiceHasChanges, setVoiceHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState("xp");
  const [levelTypeTab, setLevelTypeTab] = useState<XpType>("text");

  // 두 가지 상태(폼과 레벨 설정) 중 하나라도 변경되면 unsaved changes로 표시
  useEffect(() => {
    setHasUnsavedChanges(formIsDirty || textHasChanges || voiceHasChanges);
  }, [formIsDirty, textHasChanges, voiceHasChanges, setHasUnsavedChanges]);

  // XP 비활성화 시 레벨 탭 자동 전환
  const textXpEnabled = form.watch("textXpEnabled");
  const voiceXpEnabled = form.watch("voiceXpEnabled");

  useEffect(() => {
    // 현재 텍스트 탭인데 텍스트 XP가 비활성화되면 음성 탭으로 전환
    if (levelTypeTab === "text" && !textXpEnabled && voiceXpEnabled) {
      setLevelTypeTab("voice");
    }
    // 현재 음성 탭인데 음성 XP가 비활성화되면 텍스트 탭으로 전환
    if (levelTypeTab === "voice" && !voiceXpEnabled && textXpEnabled) {
      setLevelTypeTab("text");
    }
  }, [textXpEnabled, voiceXpEnabled, levelTypeTab]);

  // Text Level Requirements Query
  const { data: textLevelData, isLoading: textLevelLoading } = useQuery<LevelRequirement[]>({
    queryKey: ["levelRequirements", guildId, "text"],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/xp/level-requirements?type=text`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  // Voice Level Requirements Query
  const { data: voiceLevelData, isLoading: voiceLevelLoading } = useQuery<LevelRequirement[]>({
    queryKey: ["levelRequirements", guildId, "voice"],
    queryFn: async () => {
      const res = await fetch(`/api/guilds/${guildId}/xp/level-requirements?type=voice`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  useEffect(() => {
    if (textLevelData) {
      setTextRequirements(textLevelData.map(d => ({ level: d.level, requiredXp: d.requiredXp })));
      setTextHasChanges(false);
    }
  }, [textLevelData]);

  useEffect(() => {
    if (voiceLevelData) {
      setVoiceRequirements(voiceLevelData.map(d => ({ level: d.level, requiredXp: d.requiredXp })));
      setVoiceHasChanges(false);
    }
  }, [voiceLevelData]);

  // Text Level Mutation
  const saveTextLevelMutation = useMutation({
    mutationFn: async (requirements: { level: number; requiredXp: number }[]) => {
      const res = await fetch(`/api/guilds/${guildId}/xp/level-requirements?type=text`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requirements),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["levelRequirements", guildId, "text"] });
      toast({
        title: "저장 완료",
        description: "텍스트 레벨 설정이 저장되었습니다.",
      });
      setTextHasChanges(false);
    },
    onError: () => {
      toast({
        title: "저장 실패",
        description: "레벨 설정을 저장하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  // Voice Level Mutation
  const saveVoiceLevelMutation = useMutation({
    mutationFn: async (requirements: { level: number; requiredXp: number }[]) => {
      const res = await fetch(`/api/guilds/${guildId}/xp/level-requirements?type=voice`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requirements),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["levelRequirements", guildId, "voice"] });
      toast({
        title: "저장 완료",
        description: "음성 레벨 설정이 저장되었습니다.",
      });
      setVoiceHasChanges(false);
    },
    onError: () => {
      toast({
        title: "저장 실패",
        description: "레벨 설정을 저장하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  // Current type getters
  const currentRequirements = levelTypeTab === 'text' ? textRequirements : voiceRequirements;
  const setCurrentRequirements = levelTypeTab === 'text' ? setTextRequirements : setVoiceRequirements;
  const currentHasChanges = levelTypeTab === 'text' ? textHasChanges : voiceHasChanges;
  const setCurrentHasChanges = levelTypeTab === 'text' ? setTextHasChanges : setVoiceHasChanges;
  const currentSaveMutation = levelTypeTab === 'text' ? saveTextLevelMutation : saveVoiceLevelMutation;

  const handleAddLevel = () => {
    const maxLevel = currentRequirements.length > 0
      ? Math.max(...currentRequirements.map(r => r.level))
      : 0;
    const newLevel = maxLevel + 1;
    setCurrentRequirements([
      ...currentRequirements,
      { level: newLevel, requiredXp: getDefaultXpForLevel(newLevel) }
    ].sort((a, b) => a.level - b.level));
    setCurrentHasChanges(true);
  };

  const handleRemoveLevel = (level: number) => {
    setCurrentRequirements(currentRequirements.filter(r => r.level !== level));
    setCurrentHasChanges(true);
  };

  const handleXpChange = (level: number, xp: number) => {
    setCurrentRequirements(currentRequirements.map(r =>
      r.level === level ? { ...r, requiredXp: xp } : r
    ));
    setCurrentHasChanges(true);
  };

  const handleLevelChange = (oldLevel: number, newLevel: number) => {
    if (newLevel < 1 || newLevel > 999) return;
    if (currentRequirements.some(r => r.level === newLevel && r.level !== oldLevel)) {
      toast({
        title: "중복 레벨",
        description: "이미 존재하는 레벨입니다.",
        variant: "destructive",
      });
      return;
    }
    setCurrentRequirements(currentRequirements.map(r =>
      r.level === oldLevel ? { ...r, level: newLevel } : r
    ).sort((a, b) => a.level - b.level));
    setCurrentHasChanges(true);
  };

  const handleResetToDefault = () => {
    const defaultRequirements = [];
    for (let i = 1; i <= 10; i++) {
      defaultRequirements.push({
        level: i,
        requiredXp: getDefaultXpForLevel(i),
      });
    }
    setCurrentRequirements(defaultRequirements);
    setCurrentHasChanges(true);
  };

  const handleClearAll = () => {
    setCurrentRequirements([]);
    setCurrentHasChanges(true);
  };

  const handleSaveLevels = () => {
    currentSaveMutation.mutate(currentRequirements);
  };

  const isLoading = settingsLoading || textLevelLoading || voiceLevelLoading;

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse">
          <div className="h-8 w-48 rounded-lg bg-white/10" />
          <div className="h-5 w-64 rounded-lg bg-white/5 mt-2" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="animate-pulse bg-white/5 rounded-2xl p-6 border border-white/5">
              <div className="space-y-4">
                {[...Array(4)].map((_, j) => (
                  <div key={j} className="h-12 rounded-lg bg-white/10" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="animate-fade-up">
        <h1 className="text-2xl md:text-3xl font-bold text-white">XP 설정</h1>
        <p className="text-white/50 mt-1">XP 획득 및 레벨업 방식을 설정합니다</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex items-center justify-between">
          <TabsList className="bg-white/5 border border-white/10 p-1 rounded-xl">
            <TabsTrigger
              value="xp"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white rounded-lg px-4 py-2 text-white/60"
            >
              <Icon icon="solar:bolt-linear" className="mr-2 h-4 w-4" />
              XP 획득
            </TabsTrigger>
            <TabsTrigger
              value="levels"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-purple-500 data-[state=active]:text-white rounded-lg px-4 py-2 text-white/60"
            >
              <Icon icon="solar:graph-up-linear" className="mr-2 h-4 w-4" />
              레벨 설정
            </TabsTrigger>
          </TabsList>

          {activeTab === "levels" && (
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleResetToDefault}
                className="border-white/10 text-white/70 hover:bg-white/5 hover:text-white"
              >
                <Icon icon="solar:refresh-linear" className="mr-2 h-4 w-4" />
                기본값
              </Button>
              <Button
                onClick={handleAddLevel}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white"
              >
                <Icon icon="solar:add-circle-linear" className="mr-2 h-4 w-4" />
                레벨 추가
              </Button>
            </div>
          )}
        </div>

        {/* XP 획득 설정 탭 */}
        <TabsContent value="xp" className="space-y-6 animate-fade-up">
          {/* XP 시스템 설명 */}
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                <Icon icon="solar:lightbulb-bolt-linear" className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="space-y-2">
                <p className="text-sm text-indigo-300 font-medium">XP 시스템 안내</p>
                <ul className="text-sm text-indigo-300/70 space-y-1 list-disc list-inside">
                  <li><strong>텍스트 XP</strong>: 채팅 메시지를 보낼 때마다 설정된 범위 내에서 랜덤하게 XP를 획득합니다</li>
                  <li><strong>음성 XP</strong>: 음성 채널에 접속해 있는 동안 주기적으로 XP를 획득합니다</li>
                  <li><strong>쿨다운</strong>: XP를 획득한 후 다음 획득까지 대기해야 하는 시간입니다 (스팸 방지)</li>
                  <li><strong>쿨다운당 횟수</strong>: 쿨다운 시간 동안 XP를 획득할 수 있는 최대 횟수입니다</li>
                </ul>
              </div>
            </div>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitXpSettings)} className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* 텍스트 XP 설정 */}
                <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
                  <div className="p-6 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                        <Icon icon="solar:chat-line-linear" className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">텍스트 XP</h3>
                        <p className="text-white/50 text-sm">채팅 메시지 기반 경험치 부여</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-6 space-y-5">
                    <FormField
                      control={form.control}
                      name="textXpEnabled"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-white font-medium">활성화</FormLabel>
                            <FormDescription className="text-xs text-white/40">
                              채팅으로 XP 획득
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {/* XP 범위 설명 */}
                    <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-3 mb-4">
                      <p className="text-xs text-blue-300/70">
                        💡 메시지 1개당 최소~최대 범위에서 랜덤한 XP를 획득합니다
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="textXpMin"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white/70 text-sm">최소 XP</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                className="bg-white/5 border-white/10 text-white focus:border-indigo-500/50"
                              />
                            </FormControl>
                            <FormDescription className="text-xs text-white/40">
                              획득 가능한 최소 경험치
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="textXpMax"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white/70 text-sm">최대 XP</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                className="bg-white/5 border-white/10 text-white focus:border-indigo-500/50"
                              />
                            </FormControl>
                            <FormDescription className="text-xs text-white/40">
                              획득 가능한 최대 경험치
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="textCooldownSeconds"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white/70 text-sm">쿨다운 (초)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                className="bg-white/5 border-white/10 text-white focus:border-indigo-500/50"
                              />
                            </FormControl>
                            <FormDescription className="text-xs text-white/40">
                              예: 60초 = 1분마다 XP 획득 가능
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="textMaxPerCooldown"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white/70 text-sm">쿨다운당 횟수</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                className="bg-white/5 border-white/10 text-white focus:border-indigo-500/50"
                              />
                            </FormControl>
                            <FormDescription className="text-xs text-white/40">
                              예: 1 = 쿨다운 중 1회만 획득
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>

                {/* 음성 XP 설정 */}
                <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
                  <div className="p-6 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                        <Icon icon="solar:microphone-linear" className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">음성 XP</h3>
                        <p className="text-white/50 text-sm">음성 채널 활동 기반 경험치 부여</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-6 space-y-5">
                    <FormField
                      control={form.control}
                      name="voiceXpEnabled"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-white font-medium">활성화</FormLabel>
                            <FormDescription className="text-xs text-white/40">
                              음성 참여로 XP 획득
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    {/* 음성 XP 범위 설명 */}
                    <div className="bg-green-500/5 border border-green-500/10 rounded-lg p-3 mb-4">
                      <p className="text-xs text-green-300/70">
                        💡 음성 채널 접속 시 쿨다운마다 최소~최대 범위에서 랜덤한 XP를 획득합니다
                      </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="voiceXpMin"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white/70 text-sm">최소 XP</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                className="bg-white/5 border-white/10 text-white focus:border-indigo-500/50"
                              />
                            </FormControl>
                            <FormDescription className="text-xs text-white/40">
                              획득 가능한 최소 경험치
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="voiceXpMax"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white/70 text-sm">최대 XP</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                className="bg-white/5 border-white/10 text-white focus:border-indigo-500/50"
                              />
                            </FormControl>
                            <FormDescription className="text-xs text-white/40">
                              획득 가능한 최대 경험치
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="voiceCooldownSeconds"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white/70 text-sm">쿨다운 (초)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                className="bg-white/5 border-white/10 text-white focus:border-indigo-500/50"
                              />
                            </FormControl>
                            <FormDescription className="text-xs text-white/40">
                              예: 60초 = 1분마다 XP 획득 가능
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="voiceMaxPerCooldown"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white/70 text-sm">쿨다운당 횟수</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                {...field}
                                className="bg-white/5 border-white/10 text-white focus:border-indigo-500/50"
                              />
                            </FormControl>
                            <FormDescription className="text-xs text-white/40">
                              예: 1 = 쿨다운 중 1회만 획득
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={updateSettings.isPending}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25"
                >
                  <Icon icon="solar:diskette-linear" className="mr-2 h-4 w-4" />
                  {updateSettings.isPending ? "저장 중..." : "설정 저장"}
                </Button>
              </div>
            </form>
          </Form>
        </TabsContent>

        {/* 레벨 설정 탭 */}
        <TabsContent value="levels" className="space-y-6 animate-fade-up">
          {/* Level Type Sub-Tabs */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => textXpEnabled && setLevelTypeTab("text")}
              disabled={!textXpEnabled}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
                !textXpEnabled
                  ? "opacity-50 cursor-not-allowed bg-white/5 text-white/40 border-white/10"
                  : levelTypeTab === "text"
                    ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-transparent"
                    : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10"
              }`}
            >
              <Icon icon="solar:chat-line-linear" className="h-4 w-4" />
              텍스트 레벨
              {!textXpEnabled && <span className="text-xs">(비활성화됨)</span>}
            </button>
            <button
              onClick={() => voiceXpEnabled && setLevelTypeTab("voice")}
              disabled={!voiceXpEnabled}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
                !voiceXpEnabled
                  ? "opacity-50 cursor-not-allowed bg-white/5 text-white/40 border-white/10"
                  : levelTypeTab === "voice"
                    ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white border-transparent"
                    : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10"
              }`}
            >
              <Icon icon="solar:microphone-linear" className="h-4 w-4" />
              음성 레벨
              {!voiceXpEnabled && <span className="text-xs">(비활성화됨)</span>}
            </button>
          </div>

          {/* Info Card */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Icon icon="solar:info-circle-linear" className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-blue-300 font-medium">기본 공식</p>
                <p className="text-sm text-blue-300/70 mt-1">
                  레벨² × 100 (예: 레벨 5 = 2,500 XP)
                  <br />
                  커스텀 설정이 없으면 기본 공식이 적용됩니다.
                  <br />
                  {levelTypeTab === "text" ? "텍스트 XP" : "음성 XP"}를 기준으로 레벨이 계산됩니다.
                </p>
              </div>
            </div>
          </div>

          {/* Level Requirements Table */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  levelTypeTab === "text"
                    ? "bg-gradient-to-br from-blue-500 to-cyan-500"
                    : "bg-gradient-to-br from-green-500 to-emerald-500"
                }`}>
                  <Icon
                    icon={levelTypeTab === "text" ? "solar:chat-line-bold" : "solar:microphone-bold"}
                    className="w-5 h-5 text-white"
                  />
                </div>
                <div>
                  <h3 className="font-semibold text-white">
                    {levelTypeTab === "text" ? "텍스트" : "음성"} 레벨별 필요 XP
                  </h3>
                  <p className="text-white/50 text-sm">
                    {currentRequirements.length > 0
                      ? `${currentRequirements.length}개의 커스텀 레벨이 설정되어 있습니다.`
                      : "커스텀 설정이 없습니다. 기본 공식이 적용됩니다."}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6">
              {currentRequirements.length > 0 ? (
                <div className="space-y-3">
                  {/* Header */}
                  <div className="grid grid-cols-12 gap-4 px-4 text-sm font-medium text-white/40">
                    <div className="col-span-3">레벨</div>
                    <div className="col-span-4">필요 XP</div>
                    <div className="col-span-3">기본값</div>
                    <div className="col-span-2"></div>
                  </div>

                  {/* Rows */}
                  {currentRequirements.map((req) => (
                    <div
                      key={req.level}
                      className="grid grid-cols-12 items-center gap-4 rounded-xl bg-white/5 border border-white/10 p-4"
                    >
                      <div className="col-span-3">
                        <Input
                          type="number"
                          min="1"
                          max="999"
                          value={req.level}
                          onChange={(e) => handleLevelChange(req.level, parseInt(e.target.value) || 1)}
                          className="w-24 bg-white/5 border-white/10 text-white focus:border-indigo-500/50"
                        />
                      </div>
                      <div className="col-span-4">
                        <Input
                          type="number"
                          min="0"
                          value={req.requiredXp}
                          onChange={(e) => handleXpChange(req.level, parseInt(e.target.value) || 0)}
                          className="bg-white/5 border-white/10 text-white focus:border-indigo-500/50"
                        />
                      </div>
                      <div className="col-span-3 text-white/40">
                        {getDefaultXpForLevel(req.level).toLocaleString()} XP
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveLevel(req.level)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Icon icon="solar:trash-bin-trash-linear" className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                    <Icon icon="solar:graph-up-linear" className="h-8 w-8 text-white/30" />
                  </div>
                  <p className="text-white/70 font-medium">커스텀 레벨 설정이 없습니다</p>
                  <p className="text-sm text-white/40 mt-1">
                    기본 공식(레벨² × 100)이 적용됩니다
                  </p>
                  <div className="mt-6 flex justify-center gap-3">
                    <Button
                      variant="outline"
                      onClick={handleResetToDefault}
                      className="border-white/10 text-white/70 hover:bg-white/5 hover:text-white"
                    >
                      기본값으로 시작
                    </Button>
                    <Button
                      onClick={handleAddLevel}
                      className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white"
                    >
                      직접 추가
                    </Button>
                  </div>
                </div>
              )}

              {/* Clear All Button */}
              {currentRequirements.length > 0 && (
                <div className="mt-6 flex justify-between border-t border-white/10 pt-6">
                  <Button
                    variant="ghost"
                    onClick={handleClearAll}
                    className="text-white/40 hover:text-white/70 hover:bg-white/5"
                  >
                    전체 삭제 (기본 공식 사용)
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Save Button */}
          {currentHasChanges && (
            <div className="flex justify-end">
              <Button
                onClick={handleSaveLevels}
                disabled={currentSaveMutation.isPending}
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white shadow-lg shadow-green-500/25"
                size="lg"
              >
                <Icon icon="solar:diskette-linear" className="mr-2 h-4 w-4" />
                {currentSaveMutation.isPending ? "저장 중..." : `${levelTypeTab === "text" ? "텍스트" : "음성"} 레벨 저장`}
              </Button>
            </div>
          )}
        </TabsContent>

      </Tabs>
    </div>
  );
}
