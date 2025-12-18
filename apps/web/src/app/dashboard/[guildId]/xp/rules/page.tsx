"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useXpHotTimes,
  useCreateXpHotTime,
  useUpdateXpHotTime,
  useDeleteXpHotTime,
  useXpExclusions,
  useCreateXpExclusionBulk,
  useDeleteXpExclusion,
  useXpMultipliers,
  useCreateXpMultiplier,
  useUpdateXpMultiplier,
  useDeleteXpMultiplier,
  useChannels,
  useRoles,
} from "@/hooks/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useUnsavedChanges } from "@/contexts/unsaved-changes-context";
import { useEffect } from "react";
import { Plus, Trash2, Clock, Sparkles, Hash, Shield, Volume2, Percent } from "lucide-react";
import { XpHotTime, XpMultiplier } from "@/types/xp";

// Hot Time Schema
const hotTimeFormSchema = z.object({
  type: z.enum(["text", "voice", "all"]),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  multiplier: z.coerce.number().min(1).max(10),
  enabled: z.boolean(),
});

type HotTimeFormValues = z.infer<typeof hotTimeFormSchema>;

const typeLabels = {
  text: "텍스트",
  voice: "음성",
  all: "전체",
};

// Channel type constants
const CHANNEL_TYPE_TEXT = 0;
const CHANNEL_TYPE_VOICE = 2;
const CHANNEL_TYPE_ANNOUNCEMENT = 5;
const CHANNEL_TYPE_STAGE_VOICE = 13;
const CHANNEL_TYPE_FORUM = 15;

const isVoiceChannel = (type: number) =>
  type === CHANNEL_TYPE_VOICE || type === CHANNEL_TYPE_STAGE_VOICE;

export default function XpRulesPage() {
  const params = useParams();
  const guildId = params["guildId"] as string;
  const { toast } = useToast();
  const { setHasUnsavedChanges } = useUnsavedChanges();

  // Hot Time State
  const [isAddingHotTime, setIsAddingHotTime] = useState(false);
  const { data: hotTimes, isLoading: hotTimesLoading } = useXpHotTimes(guildId);
  const createHotTime = useCreateXpHotTime(guildId);
  const updateHotTime = useUpdateXpHotTime(guildId);
  const deleteHotTime = useDeleteXpHotTime(guildId);

  const hotTimeForm = useForm<HotTimeFormValues>({
    resolver: zodResolver(hotTimeFormSchema),
    defaultValues: {
      type: "all",
      startTime: "18:00",
      endTime: "22:00",
      multiplier: 2,
      enabled: true,
    },
  });

  const onSubmitHotTime = async (data: HotTimeFormValues) => {
    try {
      await createHotTime.mutateAsync(data);
      toast({
        title: "핫타임 추가 완료",
        description: "새로운 핫타임이 추가되었습니다.",
      });
      setIsAddingHotTime(false);
      hotTimeForm.reset();
    } catch {
      toast({
        title: "추가 실패",
        description: "핫타임을 추가하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleToggleHotTime = async (hotTime: XpHotTime) => {
    try {
      await updateHotTime.mutateAsync({
        id: hotTime.id,
        data: { enabled: !hotTime.enabled },
      });
      toast({
        title: hotTime.enabled ? "핫타임 비활성화" : "핫타임 활성화",
        description: `핫타임이 ${hotTime.enabled ? "비활성화" : "활성화"}되었습니다.`,
      });
    } catch {
      toast({
        title: "변경 실패",
        description: "상태를 변경하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteHotTime = async (id: number) => {
    try {
      await deleteHotTime.mutateAsync(id);
      toast({
        title: "삭제 완료",
        description: "핫타임이 삭제되었습니다.",
      });
    } catch {
      toast({
        title: "삭제 실패",
        description: "핫타임을 삭제하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  // Multiplier State
  const [isAddingMultiplier, setIsAddingMultiplier] = useState(false);
  const [multiplierTargetType, setMultiplierTargetType] = useState<"channel" | "role">("channel");
  const [multiplierTargetId, setMultiplierTargetId] = useState<string>("");
  const [multiplierValue, setMultiplierValue] = useState<number>(1.5);

  const { data: multipliers, isLoading: multipliersLoading } = useXpMultipliers(guildId);
  const createMultiplier = useCreateXpMultiplier(guildId);
  const updateMultiplier = useUpdateXpMultiplier(guildId);
  const deleteMultiplier = useDeleteXpMultiplier(guildId);

  // Exclusion State
  const [isAddingExclusion, setIsAddingExclusion] = useState(false);
  const [targetType, setTargetType] = useState<"channel" | "role">("channel");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const hotTimeFormIsDirty = hotTimeForm.formState.isDirty;

  // 추가 폼이 열려 있고 값이 입력된 경우 unsaved changes로 표시
  useEffect(() => {
    const hasHotTimeFormData = isAddingHotTime && hotTimeFormIsDirty;
    const hasExclusionFormData = isAddingExclusion && selectedIds.length > 0;
    const hasMultiplierFormData = isAddingMultiplier && multiplierTargetId !== "";
    setHasUnsavedChanges(hasHotTimeFormData || hasExclusionFormData || hasMultiplierFormData);
  }, [isAddingHotTime, hotTimeFormIsDirty, isAddingExclusion, selectedIds, isAddingMultiplier, multiplierTargetId, setHasUnsavedChanges]);

  const { data: exclusions, isLoading: exclusionsLoading } = useXpExclusions(guildId);
  const { data: channels, isLoading: channelsLoading } = useChannels(guildId, null);
  const { data: roles, isLoading: rolesLoading } = useRoles(guildId);

  const createExclusionBulk = useCreateXpExclusionBulk(guildId);
  const deleteExclusion = useDeleteXpExclusion(guildId);

  const filteredChannels = channels?.filter(
    (ch) =>
      ch.type === CHANNEL_TYPE_TEXT ||
      ch.type === CHANNEL_TYPE_VOICE ||
      ch.type === CHANNEL_TYPE_ANNOUNCEMENT ||
      ch.type === CHANNEL_TYPE_STAGE_VOICE ||
      ch.type === CHANNEL_TYPE_FORUM
  );

  const existingChannelIds = new Set(
    exclusions?.filter((e) => e.targetType === "channel").map((e) => e.targetId) ?? []
  );
  const existingRoleIds = new Set(
    exclusions?.filter((e) => e.targetType === "role").map((e) => e.targetId) ?? []
  );

  const channelOptions: MultiSelectOption[] = (filteredChannels ?? [])
    .filter((ch) => !existingChannelIds.has(ch.id))
    .map((ch) => ({
      value: ch.id,
      label: ch.name,
      icon: isVoiceChannel(ch.type) ? (
        <Volume2 className="h-4 w-4 text-green-400" />
      ) : (
        <Hash className="h-4 w-4 text-slate-400" />
      ),
    }));

  const roleOptions: MultiSelectOption[] = (roles ?? [])
    .filter((r) => !existingRoleIds.has(r.id))
    .map((r) => ({
      value: r.id,
      label: r.name,
      color: r.color === 0 ? "#99aab5" : `#${r.color.toString(16).padStart(6, "0")}`,
    }));

  const handleSubmitExclusion = async () => {
    if (selectedIds.length === 0) {
      toast({
        title: "선택 필요",
        description: "최소 하나 이상 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      await createExclusionBulk.mutateAsync({
        targetType,
        targetIds: selectedIds,
      });
      toast({
        title: "차단 추가 완료",
        description: `${selectedIds.length}개의 ${targetType === "channel" ? "채널" : "역할"}이 차단되었습니다.`,
      });
      setIsAddingExclusion(false);
      setSelectedIds([]);
    } catch {
      toast({
        title: "추가 실패",
        description: "일부 항목이 이미 존재하거나 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteExclusion = async (id: number) => {
    try {
      await deleteExclusion.mutateAsync(id);
      toast({
        title: "삭제 완료",
        description: "제외 항목이 삭제되었습니다.",
      });
    } catch {
      toast({
        title: "삭제 실패",
        description: "항목을 삭제하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const channelExclusions = exclusions?.filter((e) => e.targetType === "channel") ?? [];
  const roleExclusions = exclusions?.filter((e) => e.targetType === "role") ?? [];

  const getChannel = (id: string) => channels?.find((c) => c.id === id);
  const getChannelName = (id: string) => getChannel(id)?.name ?? id;
  const getRoleName = (id: string) => roles?.find((r) => r.id === id)?.name ?? id;

  // Multiplier Handlers
  const existingMultiplierChannelIds = new Set(
    multipliers?.filter((m) => m.targetType === "channel").map((m) => m.targetId) ?? []
  );
  const existingMultiplierRoleIds = new Set(
    multipliers?.filter((m) => m.targetType === "role").map((m) => m.targetId) ?? []
  );

  const multiplierChannelOptions: MultiSelectOption[] = (filteredChannels ?? [])
    .filter((ch) => !existingMultiplierChannelIds.has(ch.id))
    .map((ch) => ({
      value: ch.id,
      label: ch.name,
      icon: isVoiceChannel(ch.type) ? (
        <Volume2 className="h-4 w-4 text-green-400" />
      ) : (
        <Hash className="h-4 w-4 text-slate-400" />
      ),
    }));

  const multiplierRoleOptions: MultiSelectOption[] = (roles ?? [])
    .filter((r) => !existingMultiplierRoleIds.has(r.id))
    .map((r) => ({
      value: r.id,
      label: r.name,
      color: r.color === 0 ? "#99aab5" : `#${r.color.toString(16).padStart(6, "0")}`,
    }));

  const handleSubmitMultiplier = async () => {
    if (!multiplierTargetId) {
      toast({
        title: "선택 필요",
        description: "채널 또는 역할을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      await createMultiplier.mutateAsync({
        targetType: multiplierTargetType,
        targetId: multiplierTargetId,
        multiplier: multiplierValue,
      });
      toast({
        title: "배율 추가 완료",
        description: `${multiplierTargetType === "channel" ? "채널" : "역할"} 배율이 추가되었습니다.`,
      });
      setIsAddingMultiplier(false);
      setMultiplierTargetId("");
      setMultiplierValue(1.5);
    } catch {
      toast({
        title: "추가 실패",
        description: "이미 존재하거나 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateMultiplier = async (multiplier: XpMultiplier, newValue: number) => {
    try {
      await updateMultiplier.mutateAsync({
        id: multiplier.id,
        data: { multiplier: newValue },
      });
      toast({
        title: "배율 수정 완료",
        description: `배율이 ${newValue}x로 변경되었습니다.`,
      });
    } catch {
      toast({
        title: "수정 실패",
        description: "배율을 수정하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteMultiplier = async (id: number) => {
    try {
      await deleteMultiplier.mutateAsync(id);
      toast({
        title: "삭제 완료",
        description: "배율 설정이 삭제되었습니다.",
      });
    } catch {
      toast({
        title: "삭제 실패",
        description: "배율을 삭제하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const channelMultipliers = multipliers?.filter((m) => m.targetType === "channel") ?? [];
  const roleMultipliers = multipliers?.filter((m) => m.targetType === "role") ?? [];

  const isLoading = hotTimesLoading || exclusionsLoading || multipliersLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-700" />
        <div className="h-12 w-64 animate-pulse rounded bg-slate-700" />
        <Card className="animate-pulse border-slate-700 bg-slate-800/50">
          <CardContent className="py-8">
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 rounded bg-slate-700" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">XP 규칙</h1>
        <p className="text-slate-400">XP 보너스 및 제한 규칙을 설정합니다.</p>
      </div>

      <Tabs defaultValue="hottime" className="space-y-6">
        <TabsList className="bg-slate-800">
          <TabsTrigger value="hottime" className="data-[state=active]:bg-indigo-600">
            <Sparkles className="mr-2 h-4 w-4" />
            핫타임
          </TabsTrigger>
          <TabsTrigger value="multipliers" className="data-[state=active]:bg-indigo-600">
            <Percent className="mr-2 h-4 w-4" />
            배율
          </TabsTrigger>
          <TabsTrigger value="exclusions" className="data-[state=active]:bg-indigo-600">
            <Shield className="mr-2 h-4 w-4" />
            XP 차단
          </TabsTrigger>
        </TabsList>

        {/* 핫타임 탭 */}
        <TabsContent value="hottime" className="space-y-6">
          <div className="flex justify-end">
            <Button
              onClick={() => setIsAddingHotTime(true)}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              핫타임 추가
            </Button>
          </div>

          {/* Add Hot Time Form */}
          {isAddingHotTime && (
            <Card className="border-indigo-500/50 bg-slate-800/50">
              <CardHeader>
                <CardTitle className="text-white">새 핫타임 추가</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...hotTimeForm}>
                  <form onSubmit={hotTimeForm.handleSubmit(onSubmitHotTime)} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <FormField
                        control={hotTimeForm.control}
                        name="type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white">유형</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="border-slate-700 bg-slate-900">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="all">전체</SelectItem>
                                <SelectItem value="text">텍스트</SelectItem>
                                <SelectItem value="voice">음성</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={hotTimeForm.control}
                        name="startTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white">시작 시간</FormLabel>
                            <FormControl>
                              <Input
                                type="time"
                                {...field}
                                className="border-slate-700 bg-slate-900"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={hotTimeForm.control}
                        name="endTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white">종료 시간</FormLabel>
                            <FormControl>
                              <Input
                                type="time"
                                {...field}
                                className="border-slate-700 bg-slate-900"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={hotTimeForm.control}
                        name="multiplier"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white">배율</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.1"
                                min="1"
                                max="10"
                                {...field}
                                className="border-slate-700 bg-slate-900"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setIsAddingHotTime(false);
                          hotTimeForm.reset();
                        }}
                      >
                        취소
                      </Button>
                      <Button
                        type="submit"
                        disabled={createHotTime.isPending}
                        className="bg-indigo-600 hover:bg-indigo-700"
                      >
                        {createHotTime.isPending ? "추가 중..." : "추가"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}

          {/* Hot Times List */}
          <Card className="border-slate-700 bg-slate-800/50">
            <CardHeader>
              <CardTitle className="text-white">핫타임 목록</CardTitle>
              <CardDescription>특정 시간대에 XP 배율이 증가합니다.</CardDescription>
            </CardHeader>
            <CardContent>
              {hotTimes && hotTimes.length > 0 ? (
                <div className="space-y-3">
                  {hotTimes.map((hotTime) => (
                    <div
                      key={hotTime.id}
                      className="flex items-center justify-between rounded-lg border border-slate-700 p-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/20">
                          <Sparkles className="h-5 w-5 text-amber-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-white">
                              {hotTime.startTime} - {hotTime.endTime}
                            </span>
                            <Badge variant="secondary">{typeLabels[hotTime.type]}</Badge>
                            <Badge className="bg-amber-600">x{hotTime.multiplier}</Badge>
                          </div>
                          <div className="flex items-center gap-1 text-sm text-slate-400">
                            <Clock className="h-3 w-3" />
                            {hotTime.enabled ? "활성화됨" : "비활성화됨"}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={hotTime.enabled}
                          onCheckedChange={() => handleToggleHotTime(hotTime)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteHotTime(hotTime.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <Sparkles className="mx-auto h-12 w-12 text-slate-600" />
                  <p className="mt-4 text-slate-400">설정된 핫타임이 없습니다.</p>
                  <p className="text-sm text-slate-500">핫타임을 추가하여 특정 시간대에 XP 배율을 높이세요.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 배율 탭 */}
        <TabsContent value="multipliers" className="space-y-6">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="text-sm text-amber-200">
              <strong>우선순위:</strong> 역할 배율이 채널 배율보다 우선됩니다.
              여러 역할을 가진 경우 가장 높은 배율이 적용됩니다.
            </p>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={() => setIsAddingMultiplier(true)}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              배율 추가
            </Button>
          </div>

          {/* Add Multiplier Form */}
          {isAddingMultiplier && (
            <Card className="border-indigo-500/50 bg-slate-800/50">
              <CardHeader>
                <CardTitle className="text-white">새 배율 추가</CardTitle>
                <CardDescription>
                  특정 채널이나 역할에 XP 배율을 설정합니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white">유형</label>
                    <Select
                      value={multiplierTargetType}
                      onValueChange={(value: "channel" | "role") => {
                        setMultiplierTargetType(value);
                        setMultiplierTargetId("");
                      }}
                    >
                      <SelectTrigger className="border-slate-700 bg-slate-900">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="channel">채널</SelectItem>
                        <SelectItem value="role">역할</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white">
                      {multiplierTargetType === "channel" ? "채널 선택" : "역할 선택"}
                    </label>
                    <Select
                      value={multiplierTargetId}
                      onValueChange={setMultiplierTargetId}
                    >
                      <SelectTrigger className="border-slate-700 bg-slate-900">
                        <SelectValue placeholder={multiplierTargetType === "channel" ? "채널 선택" : "역할 선택"} />
                      </SelectTrigger>
                      <SelectContent>
                        {multiplierTargetType === "channel"
                          ? multiplierChannelOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                <span className="flex items-center gap-2">
                                  {opt.icon}
                                  {opt.label}
                                </span>
                              </SelectItem>
                            ))
                          : multiplierRoleOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                <span
                                  className="inline-block h-3 w-3 rounded-full mr-2"
                                  style={{ backgroundColor: opt.color }}
                                />
                                {opt.label}
                              </SelectItem>
                            ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white">배율</label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="10"
                      value={multiplierValue}
                      onChange={(e) => setMultiplierValue(parseFloat(e.target.value) || 1)}
                      className="border-slate-700 bg-slate-900"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsAddingMultiplier(false);
                      setMultiplierTargetId("");
                      setMultiplierValue(1.5);
                    }}
                  >
                    취소
                  </Button>
                  <Button
                    onClick={handleSubmitMultiplier}
                    disabled={createMultiplier.isPending || !multiplierTargetId}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    {createMultiplier.isPending ? "추가 중..." : "추가"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Multipliers Lists */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Channel Multipliers */}
            <Card className="border-slate-700 bg-slate-800/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Hash className="h-5 w-5 text-blue-500" />
                  채널별 배율
                </CardTitle>
                <CardDescription>특정 채널에서 XP 배율이 적용됩니다.</CardDescription>
              </CardHeader>
              <CardContent>
                {channelMultipliers.length > 0 ? (
                  <div className="space-y-2">
                    {channelMultipliers.map((multiplier) => {
                      const channel = getChannel(multiplier.targetId);
                      const isVoice = channel ? isVoiceChannel(channel.type) : false;
                      return (
                        <div
                          key={multiplier.id}
                          className="flex items-center justify-between rounded-lg border border-slate-700 p-3"
                        >
                          <div className="flex items-center gap-2">
                            {isVoice ? (
                              <Volume2 className="h-4 w-4 text-green-400" />
                            ) : (
                              <Hash className="h-4 w-4 text-slate-400" />
                            )}
                            <span className="text-slate-300">
                              {getChannelName(multiplier.targetId)}
                            </span>
                            <Badge className="bg-amber-600">x{multiplier.multiplier}</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              step="0.1"
                              min="0.1"
                              max="10"
                              defaultValue={multiplier.multiplier}
                              className="w-20 border-slate-700 bg-slate-900"
                              onBlur={(e) => {
                                const newValue = parseFloat(e.target.value);
                                if (newValue && newValue !== multiplier.multiplier) {
                                  handleUpdateMultiplier(multiplier, newValue);
                                }
                              }}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteMultiplier(multiplier.id)}
                              className="text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-6 text-center">
                    <Hash className="mx-auto h-8 w-8 text-slate-600" />
                    <p className="mt-2 text-sm text-slate-400">채널 배율이 없습니다.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Role Multipliers */}
            <Card className="border-slate-700 bg-slate-800/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Shield className="h-5 w-5 text-purple-500" />
                  역할별 배율
                </CardTitle>
                <CardDescription>특정 역할을 가진 유저에게 XP 배율이 적용됩니다.</CardDescription>
              </CardHeader>
              <CardContent>
                {roleMultipliers.length > 0 ? (
                  <div className="space-y-2">
                    {roleMultipliers.map((multiplier) => (
                      <div
                        key={multiplier.id}
                        className="flex items-center justify-between rounded-lg border border-slate-700 p-3"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">@{getRoleName(multiplier.targetId)}</Badge>
                          <Badge className="bg-amber-600">x{multiplier.multiplier}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="0.1"
                            min="0.1"
                            max="10"
                            defaultValue={multiplier.multiplier}
                            className="w-20 border-slate-700 bg-slate-900"
                            onBlur={(e) => {
                              const newValue = parseFloat(e.target.value);
                              if (newValue && newValue !== multiplier.multiplier) {
                                handleUpdateMultiplier(multiplier, newValue);
                              }
                            }}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteMultiplier(multiplier.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center">
                    <Shield className="mx-auto h-8 w-8 text-slate-600" />
                    <p className="mt-2 text-sm text-slate-400">역할 배율이 없습니다.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* XP 차단 탭 */}
        <TabsContent value="exclusions" className="space-y-6">
          <div className="flex justify-end">
            <Button
              onClick={() => setIsAddingExclusion(true)}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              차단 추가
            </Button>
          </div>

          {/* Add Exclusion Form */}
          {isAddingExclusion && (
            <Card className="border-indigo-500/50 bg-slate-800/50">
              <CardHeader>
                <CardTitle className="text-white">새 차단 항목 추가</CardTitle>
                <CardDescription>
                  차단할 채널 또는 역할을 여러 개 선택할 수 있습니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white">유형</label>
                    <Select
                      value={targetType}
                      onValueChange={(value: "channel" | "role") => {
                        setTargetType(value);
                        setSelectedIds([]);
                      }}
                    >
                      <SelectTrigger className="border-slate-700 bg-slate-900">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="channel">채널</SelectItem>
                        <SelectItem value="role">역할</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white">
                      {targetType === "channel" ? "채널 선택" : "역할 선택"}
                    </label>
                    <MultiSelect
                      options={targetType === "channel" ? channelOptions : roleOptions}
                      selected={selectedIds}
                      onChange={setSelectedIds}
                      placeholder={
                        targetType === "channel"
                          ? channelsLoading
                            ? "로딩 중..."
                            : "채널을 선택하세요"
                          : rolesLoading
                          ? "로딩 중..."
                          : "역할을 선택하세요"
                      }
                      isLoading={targetType === "channel" ? channelsLoading : rolesLoading}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsAddingExclusion(false);
                      setSelectedIds([]);
                    }}
                  >
                    취소
                  </Button>
                  <Button
                    onClick={handleSubmitExclusion}
                    disabled={createExclusionBulk.isPending || selectedIds.length === 0}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    {createExclusionBulk.isPending
                      ? "추가 중..."
                      : selectedIds.length > 0
                      ? `${selectedIds.length}개 추가`
                      : "추가"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Exclusions Lists */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Channel Exclusions */}
            <Card className="border-slate-700 bg-slate-800/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Hash className="h-5 w-5 text-blue-500" />
                  차단된 채널
                </CardTitle>
                <CardDescription>이 채널에서는 XP를 받을 수 없습니다.</CardDescription>
              </CardHeader>
              <CardContent>
                {channelExclusions.length > 0 ? (
                  <div className="space-y-2">
                    {channelExclusions.map((exclusion) => {
                      const channel = getChannel(exclusion.targetId);
                      const isVoice = channel ? isVoiceChannel(channel.type) : false;
                      return (
                        <div
                          key={exclusion.id}
                          className="flex items-center justify-between rounded-lg border border-slate-700 p-3"
                        >
                          <div className="flex items-center gap-2">
                            {isVoice ? (
                              <Volume2 className="h-4 w-4 text-green-400" />
                            ) : (
                              <Hash className="h-4 w-4 text-slate-400" />
                            )}
                            <span className="text-slate-300">
                              {getChannelName(exclusion.targetId)}
                            </span>
                            {isVoice && (
                              <Badge variant="outline" className="text-xs text-green-400 border-green-400/30">
                                음성
                              </Badge>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteExclusion(exclusion.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-6 text-center">
                    <Hash className="mx-auto h-8 w-8 text-slate-600" />
                    <p className="mt-2 text-sm text-slate-400">차단된 채널이 없습니다.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Role Exclusions */}
            <Card className="border-slate-700 bg-slate-800/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Shield className="h-5 w-5 text-purple-500" />
                  차단된 역할
                </CardTitle>
                <CardDescription>이 역할을 가진 유저는 XP를 받을 수 없습니다.</CardDescription>
              </CardHeader>
              <CardContent>
                {roleExclusions.length > 0 ? (
                  <div className="space-y-2">
                    {roleExclusions.map((exclusion) => (
                      <div
                        key={exclusion.id}
                        className="flex items-center justify-between rounded-lg border border-slate-700 p-3"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">@{getRoleName(exclusion.targetId)}</Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteExclusion(exclusion.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center">
                    <Shield className="mx-auto h-8 w-8 text-slate-600" />
                    <p className="mt-2 text-sm text-slate-400">차단된 역할이 없습니다.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
