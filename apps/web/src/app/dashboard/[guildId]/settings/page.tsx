"use client";

import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useXpSettings, useUpdateXpSettings, useDataRetentionSettings, useUpdateDataRetentionSettings } from "@/hooks/queries";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useUnsavedChanges } from "@/contexts/unsaved-changes-context";
import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { formatDistanceToNow, format } from "date-fns";
import { ko } from "date-fns/locale";

const settingsFormSchema = z.object({
  enabled: z.boolean(),
});

type SettingsFormValues = z.infer<typeof settingsFormSchema>;

export default function GuildSettingsPage() {
  const params = useParams();
  const guildId = params['guildId'] as string;
  const { toast } = useToast();
  const { setHasUnsavedChanges } = useUnsavedChanges();

  const { data: xpSettings, isLoading } = useXpSettings(guildId);
  const updateSettings = useUpdateXpSettings(guildId);

  // 데이터 보존 설정
  const { data: dataRetentionSettings, isLoading: isDataRetentionLoading } = useDataRetentionSettings(guildId);
  const updateDataRetention = useUpdateDataRetentionSettings(guildId);
  const [retentionDays, setRetentionDays] = useState<number>(3);

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      enabled: true,
    },
  });

  const isDirty = form.formState.isDirty;

  useEffect(() => {
    setHasUnsavedChanges(isDirty);
  }, [isDirty, setHasUnsavedChanges]);

  useEffect(() => {
    if (xpSettings) {
      form.reset({
        enabled: Boolean(xpSettings.enabled),
      });
    }
  }, [xpSettings, form]);

  useEffect(() => {
    if (dataRetentionSettings) {
      setRetentionDays(dataRetentionSettings.retentionDays);
    }
  }, [dataRetentionSettings]);

  const onSubmit = async (data: SettingsFormValues) => {
    try {
      await updateSettings.mutateAsync(data);
      form.reset(data);
      toast({
        title: "설정 저장 완료",
        description: "설정이 저장되었습니다.",
      });
    } catch {
      toast({
        title: "저장 실패",
        description: "설정을 저장하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleRetentionDaysChange = async () => {
    try {
      await updateDataRetention.mutateAsync({ retentionDays });
      toast({
        title: "설정 저장 완료",
        description: `탈퇴 유저 데이터가 ${retentionDays === 0 ? '즉시 삭제' : `${retentionDays}일 후 삭제`}됩니다.`,
      });
    } catch {
      toast({
        title: "저장 실패",
        description: "설정을 저장하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-700" />
        <Card className="animate-pulse border-slate-700 bg-slate-800/50">
          <CardHeader>
            <div className="h-6 w-32 rounded bg-slate-700" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 rounded bg-slate-700" />
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
        <h1 className="text-2xl font-bold text-white">설정</h1>
        <p className="text-slate-400">봇 기본 설정을 관리합니다.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* XP System Toggle */}
          <Card className="border-slate-700 bg-slate-800/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Icon icon="solar:bolt-linear" className="h-5 w-5 text-yellow-500" />
                XP 시스템
              </CardTitle>
              <CardDescription>XP 시스템 전체를 켜거나 끕니다.</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border border-slate-700 p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base text-white">XP 시스템 활성화</FormLabel>
                      <FormDescription>
                        비활성화하면 모든 XP 획득이 중단됩니다.
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
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={updateSettings.isPending}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {updateSettings.isPending ? "저장 중..." : "설정 저장"}
            </Button>
          </div>
        </form>
      </Form>

      {/* Bot Info */}
      <Card className="border-slate-700 bg-slate-800/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Icon icon="solar:settings-linear" className="h-5 w-5" />
            봇 정보
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">서버 ID</span>
            <code className="text-sm text-slate-300">{guildId}</code>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">봇 상태</span>
            <Badge variant="outline" className="text-slate-400">
              연결 대기
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Data Retention Settings */}
      <Card className="border-slate-700 bg-slate-800/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Icon icon="solar:clock-circle-linear" className="h-5 w-5 text-blue-500" />
            데이터 보존 설정
          </CardTitle>
          <CardDescription>
            서버를 탈퇴한 유저의 데이터 보존 기간을 설정합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border border-slate-700 p-4">
            <div className="space-y-0.5">
              <p className="text-base font-medium text-white">탈퇴 유저 데이터 보존 기간</p>
              <p className="text-sm text-slate-400">
                {retentionDays === 0
                  ? "탈퇴 즉시 데이터가 삭제됩니다."
                  : `탈퇴 후 ${retentionDays}일간 데이터가 보존됩니다. 기간 내 재입장 시 데이터가 복구됩니다.`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={365}
                value={retentionDays}
                onChange={(e) => setRetentionDays(parseInt(e.target.value) || 0)}
                className="w-20 bg-slate-700 text-white border-slate-600"
              />
              <span className="text-slate-400">일</span>
              <Button
                onClick={handleRetentionDaysChange}
                disabled={updateDataRetention.isPending || retentionDays === dataRetentionSettings?.retentionDays}
                className="bg-indigo-600 hover:bg-indigo-700"
                size="sm"
              >
                {updateDataRetention.isPending ? "저장 중..." : "저장"}
              </Button>
            </div>
          </div>

          {/* 탈퇴 대기 중인 유저 목록 */}
          {!isDataRetentionLoading && dataRetentionSettings?.leftMembers && dataRetentionSettings.leftMembers.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-300">
                삭제 대기 중인 유저 데이터 ({dataRetentionSettings.leftMembers.length}명)
              </p>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-700 divide-y divide-slate-700">
                {dataRetentionSettings.leftMembers.map((member) => (
                  <div key={member.userId} className="flex items-center justify-between p-3 hover:bg-slate-700/50">
                    <div>
                      <code className="text-sm text-slate-300">{member.userId}</code>
                      <p className="text-xs text-slate-500">
                        탈퇴: {format(new Date(member.leftAt), "yyyy-MM-dd HH:mm", { locale: ko })}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-orange-400 border-orange-400/50">
                      {formatDistanceToNow(new Date(member.expiresAt), { locale: ko, addSuffix: true })} 삭제
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-500/30 bg-red-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-400">
            <Icon icon="solar:danger-triangle-linear" className="h-5 w-5" />
            위험 구역
          </CardTitle>
          <CardDescription>주의가 필요한 작업</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-red-500/30 p-4">
            <div>
              <p className="font-medium text-white">XP 데이터 초기화</p>
              <p className="text-sm text-slate-400">
                이 서버의 모든 XP 데이터를 삭제합니다. 되돌릴 수 없습니다.
              </p>
            </div>
            <Button variant="destructive" disabled>
              초기화
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
