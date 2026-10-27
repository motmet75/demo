package com.demo.invoicedesk;

import invoice.Engine;
import java.util.*;
import java.util.concurrent.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Executes on the existing HTTP thread, with bounded admission and cooperative Engine cancellation. */
public final class InvoiceDeskTasks {
 private InvoiceDeskTasks() {}
 private static final Semaphore CAPACITY=new Semaphore(3);
 private static final ConcurrentHashMap<UUID,Task> TASKS=new ConcurrentHashMap<>();
 private static final ThreadLocal<Task> CURRENT=new ThreadLocal<>();
 private static final class Task {
  final InvoiceDeskService.Scope owner; final long started=System.currentTimeMillis();
  volatile String progress="Đang chuẩn bị"; volatile boolean cancelled; volatile Engine engine;
  Task(InvoiceDeskService.Scope owner){this.owner=owner;}
 }
 public interface Work<T>{T run() throws Exception;}
 public static <T>T run(InvoiceDeskService.Scope owner,UUID id,Work<T> work)throws Exception{
  if(!CAPACITY.tryAcquire())throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"Máy chủ đang bận. Vui lòng thử lại.");
  Task task=new Task(owner);
  if(TASKS.putIfAbsent(id,task)!=null){CAPACITY.release();throw new ResponseStatusException(HttpStatus.CONFLICT,"Mã tác vụ đã tồn tại");}
  CURRENT.set(task);
  try{return work.run();}finally{CURRENT.remove();TASKS.remove(id,task);CAPACITY.release();}
 }
 public static void bind(Engine engine){Task task=CURRENT.get();if(task!=null){task.engine=engine;engine.setProgressListener(p->task.progress=p.replace("Page ","Trang ").replace("Detecting table borders on page ","Đang nhận dạng bảng trang "));if(task.cancelled)engine.cancelImport();}}
 public static void check(){Task t=CURRENT.get();if(t!=null&&t.cancelled)throw new ResponseStatusException(HttpStatus.CONFLICT,"Đã dừng xử lý; dữ liệu cũ được giữ nguyên.");}
 private static Task owned(InvoiceDeskService.Scope scope,UUID id){Task t=TASKS.get(id);if(t==null||!t.owner.tenantId().equals(scope.tenantId())||!t.owner.companyId().equals(scope.companyId())||!t.owner.username().equalsIgnoreCase(scope.username()))throw new ResponseStatusException(HttpStatus.NOT_FOUND);return t;}
 public static Object status(InvoiceDeskService.Scope scope,UUID id){Task t=owned(scope,id);return Map.of("progress",t.progress,"cancelled",t.cancelled);}
 public static void cancel(InvoiceDeskService.Scope scope,UUID id){Task t=owned(scope,id);t.cancelled=true;if(t.engine!=null)t.engine.cancelImport();}
}
