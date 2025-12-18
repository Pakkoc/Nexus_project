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
import { Plus, Trash2, Clock, Sparkles, Hash, Shield, Volume2 } from "lucide-react";
import { XpHotTime } from "@/types/xp";

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

  // Exclusion State
  const [isAddingExclusion, setIsAddingExclusion] = useState(false);
  const [targetType, setTargetType] = useState<"channel" | "role">("channel");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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

  const isLoading = hotTimesLoading || exclusionsLoading;

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
