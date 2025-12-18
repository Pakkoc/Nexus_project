"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import {
  useLevelRewards,
  useCreateLevelRewardBulk,
  useUpdateLevelReward,
  useDeleteLevelReward,
  useLevelChannels,
  useCreateLevelChannel,
  useDeleteLevelChannel,
  useRoles,
  useChannels,
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
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useUnsavedChanges } from "@/contexts/unsaved-changes-context";
import { useEffect } from "react";
import { Plus, Trash2, Trophy, Star, Unlock, Hash } from "lucide-react";
import { LevelReward } from "@/types/xp";

export default function LevelRewardsPage() {
  const params = useParams();
  const guildId = params["guildId"] as string;
  const { toast } = useToast();
  const { setHasUnsavedChanges } = useUnsavedChanges();

  // Role Rewards State
  const [isAddingReward, setIsAddingReward] = useState(false);
  const [rewardLevel, setRewardLevel] = useState(5);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [removeOnHigherLevel, setRemoveOnHigherLevel] = useState(false);

  const { data: rewards, isLoading: rewardsLoading } = useLevelRewards(guildId);
  const { data: roles, isLoading: rolesLoading } = useRoles(guildId);
  const createRewardBulk = useCreateLevelRewardBulk(guildId);
  const updateReward = useUpdateLevelReward(guildId);
  const deleteReward = useDeleteLevelReward(guildId);

  const roleOptions: MultiSelectOption[] = (roles ?? []).map((r) => ({
    value: r.id,
    label: r.name,
    color: r.color === 0 ? "#99aab5" : `#${r.color.toString(16).padStart(6, "0")}`,
  }));

  const handleSubmitReward = async () => {
    if (selectedRoleIds.length === 0) {
      toast({
        title: "선택 필요",
        description: "최소 하나 이상의 역할을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (rewardLevel < 1 || rewardLevel > 999) {
      toast({
        title: "레벨 오류",
        description: "레벨은 1~999 사이여야 합니다.",
        variant: "destructive",
      });
      return;
    }

    try {
      await createRewardBulk.mutateAsync({
        level: rewardLevel,
        roleIds: selectedRoleIds,
        removeOnHigherLevel,
      });
      toast({
        title: "보상 추가 완료",
        description: `레벨 ${rewardLevel}에 ${selectedRoleIds.length}개의 역할이 추가되었습니다.`,
      });
      setIsAddingReward(false);
      setSelectedRoleIds([]);
      setRewardLevel(5);
      setRemoveOnHigherLevel(false);
    } catch {
      toast({
        title: "추가 실패",
        description: "일부 보상이 이미 존재하거나 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleToggleRemove = async (reward: LevelReward) => {
    try {
      await updateReward.mutateAsync({
        id: reward.id,
        data: { removeOnHigherLevel: !reward.removeOnHigherLevel },
      });
      toast({
        title: "설정 변경 완료",
        description: "역할 제거 설정이 변경되었습니다.",
      });
    } catch {
      toast({
        title: "변경 실패",
        description: "설정을 변경하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteReward = async (id: number) => {
    try {
      await deleteReward.mutateAsync(id);
      toast({
        title: "삭제 완료",
        description: "레벨 보상이 삭제되었습니다.",
      });
    } catch {
      toast({
        title: "삭제 실패",
        description: "보상을 삭제하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const getRole = (id: string) => roles?.find((r) => r.id === id);
  const sortedRewards = [...(rewards ?? [])].sort((a, b) => a.level - b.level);

  // Level Channels State
  const [isAddingChannel, setIsAddingChannel] = useState(false);
  const [channelLevel, setChannelLevel] = useState(5);
  const [selectedChannelId, setSelectedChannelId] = useState("");

  // 추가 폼이 열려 있고 값이 입력된 경우 unsaved changes로 표시
  useEffect(() => {
    const hasRewardFormData = isAddingReward && selectedRoleIds.length > 0;
    const hasChannelFormData = isAddingChannel && selectedChannelId !== "";
    setHasUnsavedChanges(hasRewardFormData || hasChannelFormData);
  }, [isAddingReward, selectedRoleIds, isAddingChannel, selectedChannelId, setHasUnsavedChanges]);

  const { data: levelChannels, isLoading: channelsLoading } = useLevelChannels(guildId);
  const { data: channels, isLoading: allChannelsLoading } = useChannels(guildId);
  const createLevelChannel = useCreateLevelChannel(guildId);
  const deleteLevelChannel = useDeleteLevelChannel(guildId);

  const assignedChannelIds = new Set(levelChannels?.map((lc) => lc.channelId) ?? []);
  const availableChannels = (channels ?? []).filter((c) => !assignedChannelIds.has(c.id));

  const handleSubmitChannel = async () => {
    if (!selectedChannelId) {
      toast({
        title: "선택 필요",
        description: "채널을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (channelLevel < 1 || channelLevel > 999) {
      toast({
        title: "레벨 오류",
        description: "레벨은 1~999 사이여야 합니다.",
        variant: "destructive",
      });
      return;
    }

    try {
      await createLevelChannel.mutateAsync({
        level: channelLevel,
        channelId: selectedChannelId,
      });
      toast({
        title: "해금 채널 추가 완료",
        description: `레벨 ${channelLevel}에 채널이 추가되었습니다.`,
      });
      setIsAddingChannel(false);
      setSelectedChannelId("");
      setChannelLevel(5);
    } catch {
      toast({
        title: "추가 실패",
        description: "채널이 이미 다른 레벨에 연결되어 있거나 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteChannel = async (id: number) => {
    try {
      await deleteLevelChannel.mutateAsync(id);
      toast({
        title: "삭제 완료",
        description: "해금 채널이 삭제되었습니다.",
      });
    } catch {
      toast({
        title: "삭제 실패",
        description: "채널을 삭제하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const getChannel = (id: string) => channels?.find((c) => c.id === id);
  const sortedLevelChannels = [...(levelChannels ?? [])].sort((a, b) => a.level - b.level);

  const isLoading = rewardsLoading || channelsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-700" />
        <div className="h-12 w-64 animate-pulse rounded bg-slate-700" />
        <Card className="animate-pulse border-slate-700 bg-slate-800/50">
          <CardContent className="py-8">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
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
        <h1 className="text-2xl font-bold text-white">레벨 보상</h1>
        <p className="text-slate-400">레벨 달성 시 지급할 역할과 해금 채널을 설정합니다.</p>
      </div>

      <Tabs defaultValue="roles" className="space-y-6">
        <TabsList className="bg-slate-800">
          <TabsTrigger value="roles" className="data-[state=active]:bg-indigo-600">
            <Trophy className="mr-2 h-4 w-4" />
            역할 보상
          </TabsTrigger>
          <TabsTrigger value="channels" className="data-[state=active]:bg-indigo-600">
            <Unlock className="mr-2 h-4 w-4" />
            해금 채널
          </TabsTrigger>
        </TabsList>

        {/* 역할 보상 탭 */}
        <TabsContent value="roles" className="space-y-6">
          <div className="flex justify-end">
            <Button
              onClick={() => setIsAddingReward(true)}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              보상 추가
            </Button>
          </div>

          {/* Add Reward Form */}
          {isAddingReward && (
            <Card className="border-indigo-500/50 bg-slate-800/50">
              <CardHeader>
                <CardTitle className="text-white">새 레벨 보상 추가</CardTitle>
                <CardDescription>
                  레벨과 역할을 여러 개 선택할 수 있습니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white">레벨</label>
                    <Input
                      type="number"
                      min="1"
                      max="999"
                      value={rewardLevel}
                      onChange={(e) => setRewardLevel(parseInt(e.target.value) || 1)}
                      className="border-slate-700 bg-slate-900"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white">역할 선택</label>
                    <MultiSelect
                      options={roleOptions}
                      selected={selectedRoleIds}
                      onChange={setSelectedRoleIds}
                      placeholder={rolesLoading ? "로딩 중..." : "역할을 선택하세요"}
                      isLoading={rolesLoading}
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-3 rounded-lg border border-slate-700 p-4">
                  <Switch
                    checked={removeOnHigherLevel}
                    onCheckedChange={setRemoveOnHigherLevel}
                  />
                  <div className="space-y-1 leading-none">
                    <label className="text-sm font-medium text-white">
                      상위 레벨 달성 시 역할 제거
                    </label>
                    <p className="text-sm text-slate-400">
                      다음 레벨 보상을 받으면 이 역할을 제거합니다.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsAddingReward(false);
                      setSelectedRoleIds([]);
                      setRewardLevel(5);
                      setRemoveOnHigherLevel(false);
                    }}
                  >
                    취소
                  </Button>
                  <Button
                    onClick={handleSubmitReward}
                    disabled={createRewardBulk.isPending || selectedRoleIds.length === 0}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    {createRewardBulk.isPending
                      ? "추가 중..."
                      : selectedRoleIds.length > 0
                      ? `${selectedRoleIds.length}개 추가`
                      : "추가"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Rewards List */}
          <Card className="border-slate-700 bg-slate-800/50">
            <CardHeader>
              <CardTitle className="text-white">역할 보상 목록</CardTitle>
              <CardDescription>레벨 달성 시 지급되는 역할</CardDescription>
            </CardHeader>
            <CardContent>
              {sortedRewards.length > 0 ? (
                <div className="space-y-3">
                  {sortedRewards.map((reward) => {
                    const role = getRole(reward.roleId);
                    return (
                      <div
                        key={reward.id}
                        className="flex items-center justify-between rounded-lg border border-slate-700 p-4"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/20">
                            <Star className="h-6 w-6 text-amber-500" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-bold text-white">
                                레벨 {reward.level}
                              </span>
                              <Badge
                                variant="secondary"
                                style={{
                                  backgroundColor: role?.color
                                    ? `#${role.color.toString(16).padStart(6, "0")}20`
                                    : undefined,
                                  color: role?.color
                                    ? `#${role.color.toString(16).padStart(6, "0")}`
                                    : undefined,
                                  borderColor: role?.color
                                    ? `#${role.color.toString(16).padStart(6, "0")}40`
                                    : undefined,
                                }}
                              >
                                @{role?.name ?? reward.roleId}
                              </Badge>
                            </div>
                            <p className="text-sm text-slate-400">
                              {reward.removeOnHigherLevel
                                ? "상위 레벨 달성 시 제거됨"
                                : "영구 역할"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={reward.removeOnHigherLevel}
                              onCheckedChange={() => handleToggleRemove(reward)}
                            />
                            <span className="text-sm text-slate-400">제거</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteReward(reward.id)}
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
                <div className="py-12 text-center">
                  <Trophy className="mx-auto h-12 w-12 text-slate-600" />
                  <p className="mt-4 text-slate-400">설정된 레벨 보상이 없습니다.</p>
                  <p className="text-sm text-slate-500">
                    레벨 보상을 추가하여 유저들에게 동기를 부여하세요.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 해금 채널 탭 */}
        <TabsContent value="channels" className="space-y-6">
          <div className="flex justify-end">
            <Button
              onClick={() => setIsAddingChannel(true)}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              해금 채널 추가
            </Button>
          </div>

          {/* Add Channel Form */}
          {isAddingChannel && (
            <Card className="border-indigo-500/50 bg-slate-800/50">
              <CardHeader>
                <CardTitle className="text-white">새 해금 채널 추가</CardTitle>
                <CardDescription>
                  특정 레벨에 도달하면 접근 가능한 채널을 설정합니다.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white">레벨</label>
                    <Input
                      type="number"
                      min="1"
                      max="999"
                      value={channelLevel}
                      onChange={(e) => setChannelLevel(parseInt(e.target.value) || 1)}
                      className="border-slate-700 bg-slate-900"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-white">채널 선택</label>
                    <Select
                      value={selectedChannelId}
                      onValueChange={setSelectedChannelId}
                    >
                      <SelectTrigger className="border-slate-700 bg-slate-900">
                        <SelectValue placeholder={allChannelsLoading ? "로딩 중..." : "채널을 선택하세요"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableChannels.map((channel) => (
                          <SelectItem key={channel.id} value={channel.id}>
                            <div className="flex items-center gap-2">
                              <Hash className="h-4 w-4 text-slate-400" />
                              {channel.name}
                            </div>
                          </SelectItem>
                        ))}
                        {availableChannels.length === 0 && (
                          <div className="px-2 py-4 text-center text-sm text-slate-400">
                            사용 가능한 채널이 없습니다.
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsAddingChannel(false);
                      setSelectedChannelId("");
                      setChannelLevel(5);
                    }}
                  >
                    취소
                  </Button>
                  <Button
                    onClick={handleSubmitChannel}
                    disabled={createLevelChannel.isPending || !selectedChannelId}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    {createLevelChannel.isPending ? "추가 중..." : "추가"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Level Channels List */}
          <Card className="border-slate-700 bg-slate-800/50">
            <CardHeader>
              <CardTitle className="text-white">해금 채널 목록</CardTitle>
              <CardDescription>레벨별 접근 가능 채널 설정</CardDescription>
            </CardHeader>
            <CardContent>
              {sortedLevelChannels.length > 0 ? (
                <div className="space-y-3">
                  {sortedLevelChannels.map((levelChannel) => {
                    const channel = getChannel(levelChannel.channelId);
                    return (
                      <div
                        key={levelChannel.id}
                        className="flex items-center justify-between rounded-lg border border-slate-700 p-4"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/20">
                            <Unlock className="h-6 w-6 text-green-500" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-bold text-white">
                                레벨 {levelChannel.level}
                              </span>
                              <Badge
                                variant="secondary"
                                className="bg-slate-700 text-slate-300"
                              >
                                <Hash className="mr-1 h-3 w-3" />
                                {channel?.name ?? levelChannel.channelId}
                              </Badge>
                            </div>
                            <p className="text-sm text-slate-400">
                              레벨 {levelChannel.level} 달성 시 채널 접근 권한 부여
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteChannel(levelChannel.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <Unlock className="mx-auto h-12 w-12 text-slate-600" />
                  <p className="mt-4 text-slate-400">설정된 해금 채널이 없습니다.</p>
                  <p className="text-sm text-slate-500">
                    해금 채널을 추가하여 레벨업 보상으로 채널 접근 권한을 부여하세요.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
