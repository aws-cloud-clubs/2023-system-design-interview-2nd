# 📌 낮은 latency와 high availablity를 위한 전략

# #1 Core Serving Platform

2018년 대비 2020년에 4배 성장한 기업

## e-commerce data business logic

- 상품을 구입해서 직배송하는 형태로 비즈니스 운영
- 이를 로켓 배송(=로켓 프레시)로 빠른 배송 서비스 제공
- 다양한 데이터를 MSA 형태로 관리

  Catalog, Pricing&Benefit, Stock&Fulfillment, Review, Benefit가 각각 마이크로 서비스임

  → 각각의 도메인에서 데이터를 따로 불러와 합쳐서 화면에 보여줌

  → 각각의 데이터들은 개인화되어있으며 실시간으로 변함

  ![Screenshot 2023-08-25 at 1 24 23 AM](https://github.com/aws-cloud-clubs/2023-system-design-interview-2nd/assets/79203421/b0751114-1999-483d-b0f3-c70e0e55dc5a)


이런 다양한 데이터를 각 고객 페이지에 불러와야 한다면,
각각의 백엔드 시스템이 굉장히 고가용성이어야 하고,
공통으로 적용되어야 하는 비즈니스 로직은 중복 코드로 남을 것.

→ 모든 페이지에서 공통으로 사용되는 데이터와 비즈니스 로직을 처리하는 마이크로 서비스가 필요

![Screen![Screenshot 2023-08-25 at 1 28 23 AM](https://github.com/aws-cloud-clubs/2023-system-design-interview-2nd/assets/79203421/2cc7aa3e-3131-4eb6-b04d-13ba05eee077)

## Core Serving Layer

쿠팡에는 의도적으로 SPOF를 만드는 마이크로 서비스가 존재 ⇒ core serving layer

아래 2가지 레이어가 있음.

- Data Read Layer: 데이터 조회가 가장 빈번하게 일어나기 때문에 캐싱 용도
- Business Logic Layer: 공통 비즈니스 로직 serving 용도

### 목표

- 장애없이 99.99%라는 높은 가용성 제공해야 하고, 만약 장애 발생 시에도 최소한의 리커버리 시간 내에 복구되어야 한다.
- 높은 read 트래픽을 감당할 수 있도록 high throughput과 low latency로 data를 서빙해야함.
- 여러 도메인 데이터를 모아서 제공하며, 실시간으로 변경이 많기 때문에 데이터의 일관성, 최신성을 보장해야 함.

### 구성

- 모든 페이지에서 호출할 수 있도록 다음과 같이 하나의 마이크로서비스가 떠 있음
- 모든 페이지에 필요한 데이터와 비즈니스 로직을 서빙함
- core serving layer가 각각의 도메인을 aware하기 보다는 각각의 도메인이 데이터가 변경될 때마다 큐에 보내고 해당 데이터를 NoSQL 스토리지에 저장함

![Screenshot 2023-08-25 at 2 24 13 AM](https://github.com/aws-cloud-clubs/2023-system-design-interview-2nd/assets/79203421/81b20df8-40a5-4af7-ad97-bf3d9a203a1e)

아래 사진처럼 각 도메인에서 자기가 맡은 정보만 업데이트 함

![Screenshot 2023-08-25 at 2 19 43 AM](https://github.com/aws-cloud-clubs/2023-system-design-interview-2nd/assets/79203421/c00306b5-ffb2-469b-b7ec-9c5885097171)

NoSQL 데이터베이스를 사용함으로써 트랜잭션 없이 언젠가는 반영되는 eventual consistency 모델을 사용하면서 한번의 read로 모든 도메인의 데이터를 조회할 수 있음 → read throughput

- unified된 데이터 스토리지를 통해 여러 도메인으로 나가는 IO를 줄일 수 있고
- common storage로 높은 throughput을 낼 수 있었음

하지만 더 많은 read 트래픽을 처리하기 위해 캐시 레이어 필요

common storage는 persistent store 성격이 강한 반면,

cache는 높은 throughput, 낮은 latency에 집중

## Cache Layer

고성능 캐시 레이어를 통해 common storage layer보다 10배 높은 throughput과 1/3배의 latency로 데이터 제공 가능

### **주의할 점**

스토리지에 반영된 데이터가 캐시에 반영되지 않아 캐시의 데이터(=과거 데이터)로 서빙되는 현상

이를 해결하기 위해 cache invalidation logic이 존재함.

데이터가 변경될 때마다 해당 데이터들은 notification queue에 보내지고 이를 사용해 캐시에 있는 데이터를 최신 데이터로 변경

![Screenshot 2023-08-25 at 2 17 48 AM](https://github.com/aws-cloud-clubs/2023-system-design-interview-2nd/assets/79203421/864c3806-0cbb-43d6-9aed-5dffb8826bf2)

### 초단위로 변경되는 정보!
는?

(가격, 할인정보, 배송시간, 재고 등)

real time data streaming 도입

다른 마이크로 서비스에서 변경된 데이터를 큐에서 읽고 별도의 캐시에 바로 씀.

common serving layer는 캐시와 리얼타임 캐시를 동시에 읽고 보다 최신 데이터가 있는 경우 해당 데이터를 서빙할 수 있게 설계함.

![Screenshot 2023-08-25 at 2 17 17 AM](https://github.com/aws-cloud-clubs/2023-system-design-interview-2nd/assets/79203421/399aabe0-7d09-459a-a4ea-9b228f7ce2bc)

## High Availability Strategies

core serving layer는 모든 IO가 읽어나는 곳에 장애 발생 시 해당 장애를 isolation시켜 cascading되지 않도록 해야 함.

circuit breaker 기술을 통해 해당 컴포넌트의 장애를 고립시키고, 필요 시 수동으로 해당 컴포넌트로 가는 IO들을 끌 수 있게끔 설계

### CSP (critical serving path)

고객 경험에 중대한 영향을 미치는 페이지만을 위한 클러스터가 따로 존재.

- CSP cluster, 그 외 클러스터는 N-SCP cluster라고 함

서로의 클러스터는 장애를 isolation하기 위해 분리되어 있음.

![Screenshot 2023-08-25 at 1 41 11 AM](https://github.com/aws-cloud-clubs/2023-system-design-interview-2nd/assets/79203421/bf8f8e01-8422-4b8a-b939-113af0e306e2)

### Core Serving Template

여러 도메인이 구조는 같지만, 다른 코드 베이스로 동작한다면 중복 코드가 증가하므로 관리가 어려워짐.

core serving layer를 쉽게 만들기 위해 core serving template을 만듦.

핵심 로직은 공유, configuration에 의해 동작 변경  (Configuration As Code)

![Screenshot 2023-08-25 at 1 37 21 AM](https://github.com/aws-cloud-clubs/2023-system-design-interview-2nd/assets/79203421/c33fe774-24b1-4b3c-8775-db492de22507)