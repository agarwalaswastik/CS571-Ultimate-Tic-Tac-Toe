.PHONY: clean

CFLAGS=-c -Wall -O3

all: run.out

run.out: bin/main.o bin/board.o
	g++ -Wall $^ -o $@

bin/main.o: src/main.cpp
	@mkdir -p $(@D)
	g++ $(CFLAGS) $^ -o $@

bin/board.o: src/board.cpp
	@mkdir -p $(@D)
	g++ $(CFLAGS) $^ -o $@

clean:
	rm -rf bin/ *.out